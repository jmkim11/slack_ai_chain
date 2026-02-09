import { Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import OpenAI from 'openai';
import { RoomService } from '../../../room/room.service';
import { ReservationService } from '../../../reservation/reservation.service';
import { KnowledgeService } from '../../../knowledge/knowledge.service';

@Injectable()
export class ToolRegistryService {
    constructor(
        private readonly roomService: RoomService,
        private readonly reservationService: ReservationService,
        private readonly knowledgeService: KnowledgeService,
    ) { }

    // 1. Tool Definitions (Schema & Metadata)
    // These are sent to OpenAI to describe what the agent can do.
    public getTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
        return [
            {
                type: 'function',
                function: {
                    name: 'getAvailableRooms',
                    description: 'Find available meeting rooms based on date, time, and optional characteristics.',
                    parameters: {
                        type: 'object',
                        properties: {
                            date: { type: 'string', description: 'Date in YYYY-MM-DD format (e.g., 2026-02-09)' },
                            startTime: { type: 'string', description: 'Start time in HH:mm format (e.g., 14:00)' },
                            endTime: { type: 'string', description: 'End time in HH:mm format (e.g., 15:00)' },
                            characteristics: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Optional features like "quiet", "TV", "view"'
                            },
                        },
                        required: ['date', 'startTime', 'endTime'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'createReservation',
                    description: 'Book a meeting room. REQUIRES user confirmation.',
                    parameters: {
                        type: 'object',
                        properties: {
                            roomId: { type: 'number', description: 'ID of the room to book' },
                            date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                            startTime: { type: 'string', description: 'Start time in HH:mm format' },
                            endTime: { type: 'string', description: 'End time in HH:mm format' },
                            topic: { type: 'string', description: 'Meeting topic/title' },
                        },
                        required: ['roomId', 'date', 'startTime', 'endTime', 'topic'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'searchKnowledge',
                    description: 'Search company policies, guidelines, or facility information (e.g., wifi, guests, coffee).',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'The search query or question.' },
                        },
                        required: ['query'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'getUserPreference',
                    description: 'Get user\'s booking history statistics (favorite room, last topic). Use this when user says "my usual" or "like last time".',
                    parameters: {
                        type: 'object',
                        properties: {
                            userSlackId: { type: 'string', description: 'Optional. Defaults to current user if omitted.' },
                        },
                    },
                },
            },
        ];
    }

    // 2. Output Validation Schemas (Guardrails)
    // Ensure the AI's arguments match our internal expectations/types.
    private schemas = {
        getAvailableRooms: z.object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format YYYY-MM-DD"),
            startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format HH:mm"),
            endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format HH:mm"),
            characteristics: z.array(z.string()).optional(),
        }),
        createReservation: z.object({
            roomId: z.number(),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            startTime: z.string().regex(/^\d{2}:\d{2}$/),
            endTime: z.string().regex(/^\d{2}:\d{2}$/),
            topic: z.string().min(1),
        }),
        searchKnowledge: z.object({
            query: z.string().min(1),
        }),
        getUserPreference: z.object({
            userSlackId: z.string().optional(),
        }),
    };

    // 3. Secure Execution (The Gatekeeper)
    async execute(toolName: string, args: any, userSlackId: string) {
        console.log(`[ToolRegistry] Executing ${toolName} with args:`, args);

        try {
            if (toolName === 'getAvailableRooms') {
                const validated = this.schemas.getAvailableRooms.parse(args);

                // Additional Guardrail: Date Logic
                const today = new Date().toISOString().split('T')[0];
                if (validated.date < today) {
                    return { error: "Cannot search for rooms in the past." };
                }

                // Convert strings to Date objects if needed by service? 
                // Service expects string HH:mm, but date object.
                const dateObj = new Date(validated.date);

                const rooms = await this.roomService.findAvailableRooms(
                    dateObj,
                    validated.startTime,
                    validated.endTime,
                    undefined,
                    validated.characteristics
                );

                return {
                    result: rooms.map(r => ({
                        id: r.id,
                        name: r.name,
                        characteristics: r.characteristics,
                        capacity: r.capacity
                    }))
                };
            }

            if (toolName === 'createReservation') {
                const validated = this.schemas.createReservation.parse(args);

                // Additional Guardrail: Business Logic
                const start = new Date(`${validated.date}T${validated.startTime}:00`);
                const end = new Date(`${validated.date}T${validated.endTime}:00`);

                if (start < new Date()) {
                    return { error: "Cannot create a reservation in the past." };
                }

                const reservation = await this.reservationService.createReservation(
                    validated.roomId,
                    userSlackId,
                    start,
                    end,
                    validated.topic
                );

                return { success: true, reservationId: reservation.id, message: "Reservation Confirmed" };
            }

            if (toolName === 'searchKnowledge') {
                const validated = this.schemas.searchKnowledge.parse(args);
                const answer = await this.knowledgeService.search(validated.query);
                return { result: answer };
            }

            if (toolName === 'getUserPreference') {
                const validated = this.schemas.getUserPreference.parse(args);
                const targetUserId = validated.userSlackId || userSlackId;
                const stats = await this.reservationService.getUserStats(targetUserId);

                if (!stats) return { message: "No booking history found for this user." };

                // Get Room Name for better context
                try {
                    const room = await this.roomService.findById(stats.favoriteRoomId);
                    return {
                        summary: `User frequently books ${room?.name} (ID: ${stats.favoriteRoomId}).`,
                        details: {
                            favoriteRoomId: stats.favoriteRoomId,
                            favoriteRoomName: room?.name,
                            totalBookings: stats.totalBookings,
                            lastMeetingTopic: stats.lastTopic
                        }
                    };
                } catch (e) {
                    return {
                        favoriteRoomId: stats.favoriteRoomId,
                        totalBookings: stats.totalBookings,
                        note: "Room details could not be fetched."
                    };
                }
            }

            throw new BadRequestException(`Unknown tool: ${toolName}`);

        } catch (e) {
            if (e instanceof z.ZodError) {
                return { error: "Validation Error", details: (e as any).errors };
            }
            if (e instanceof Error) {
                return { error: e.message };
            }
            return { error: "Unknown error" };
        }
    }
}
