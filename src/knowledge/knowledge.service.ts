import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface PolicyItem {
    category: string;
    question: string;
    keywords: string[];
    answer: string;
}

@Injectable()
export class KnowledgeService implements OnModuleInit {
    private policies: PolicyItem[] = [];
    private readonly logger = new Logger(KnowledgeService.name);

    onModuleInit() {
        this.loadPolicies();
    }

    private loadPolicies() {
        try {
            const filePath = path.join(process.cwd(), 'resources', 'company_policy.json');
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                this.policies = JSON.parse(data);
                this.logger.log(`Loaded ${this.policies.length} policy items.`);
            } else {
                this.logger.warn(`Policy file not found at ${filePath}`);
            }
        } catch (error) {
            this.logger.error('Failed to load policies', error);
        }
    }

    async search(query: string): Promise<string> {
        if (!query) return "Please provide a search query.";

        const queryLower = query.toLowerCase();
        const searchTerms = queryLower.split(' ').filter(word => word.length > 2); // Simple tokenization

        // Simple scoring based on keyword match
        const scored = this.policies.map(policy => {
            let score = 0;
            // Keywords match (high weight)
            policy.keywords.forEach(kw => {
                if (queryLower.includes(kw)) score += 5;
            });
            // Question match (medium weight)
            if (policy.question.toLowerCase().includes(queryLower)) score += 10;

            // Text overlap (low weight)
            searchTerms.forEach(term => {
                if (policy.question.toLowerCase().includes(term)) score += 1;
                if (policy.answer.toLowerCase().includes(term)) score += 0.5;
            });

            return { policy, score };
        });

        // Filter and sort
        const results = scored
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3); // Top 3

        if (results.length === 0) {
            return "I couldn't find any specific policy regarding that. Please check the EnterMate portal.";
        }

        // Format for LLM context
        return results.map(r => `[${r.policy.category}] Q: ${r.policy.question}\nA: ${r.policy.answer}`).join('\n---\n');
    }
}
