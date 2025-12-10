import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_KEY || ''
);

export interface ConversationTemplate {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    category: string;
    system_prompt: string;
    greeting?: string;
    example_questions?: string[];
    tags?: string[];
    is_public: boolean;
    usage_count: number;
    created_at: string;
    updated_at: string;
}

export interface TemplateCreate {
    user_id: string;
    name: string;
    description?: string;
    category?: string;
    system_prompt: string;
    greeting?: string;
    example_questions?: string[];
    tags?: string[];
    is_public?: boolean;
}

/**
 * Conversation Templates Service
 * Manages reusable conversation templates
 */
export class TemplatesService {
    /**
     * List all templates (user's own + public)
     */
    async listTemplates(userId: string, category?: string) {
        try {
            let query = supabase
                .from('conversation_templates')
                .select('*')
                .or(`user_id.eq.${userId},is_public.eq.true`)
                .order('created_at', { ascending: false });

            if (category) {
                query = query.eq('category', category);
            }

            const { data, error } = await query;

            if (error) throw error;

            return { success: true, data };

        } catch (error: any) {
            console.error('Error listing templates:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get a specific template
     */
    async getTemplate(templateId: string) {
        try {
            const { data, error } = await supabase
                .from('conversation_templates')
                .select('*')
                .eq('id', templateId)
                .single();

            if (error) throw error;

            return { success: true, data };

        } catch (error: any) {
            console.error('Error getting template:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a new template
     */
    async createTemplate(template: TemplateCreate) {
        try {
            const { data, error } = await supabase
                .from('conversation_templates')
                .insert({
                    user_id: template.user_id,
                    name: template.name,
                    description: template.description,
                    category: template.category || 'general',
                    system_prompt: template.system_prompt,
                    greeting: template.greeting,
                    example_questions: template.example_questions || [],
                    tags: template.tags || [],
                    is_public: template.is_public || false
                })
                .select()
                .single();

            if (error) throw error;

            console.log(`✅ Created template: ${data.name}`);
            return { success: true, data };

        } catch (error: any) {
            console.error('Error creating template:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update a template
     */
    async updateTemplate(templateId: string, updates: Partial<TemplateCreate>) {
        try {
            const { data, error } = await supabase
                .from('conversation_templates')
                .update(updates)
                .eq('id', templateId)
                .select()
                .single();

            if (error) throw error;

            console.log(`✅ Updated template: ${templateId}`);
            return { success: true, data };

        } catch (error: any) {
            console.error('Error updating template:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a template
     */
    async deleteTemplate(templateId: string) {
        try {
            const { error } = await supabase
                .from('conversation_templates')
                .delete()
                .eq('id', templateId);

            if (error) throw error;

            console.log(`✅ Deleted template: ${templateId}`);
            return { success: true };

        } catch (error: any) {
            console.error('Error deleting template:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Increment usage count
     */
    async incrementUsage(templateId: string) {
        try {
            const { error } = await supabase.rpc('increment_template_usage', {
                template_id: templateId
            });

            if (error) {
                // Fallback if RPC doesn't exist
                const { data: template } = await supabase
                    .from('conversation_templates')
                    .select('usage_count')
                    .eq('id', templateId)
                    .single();

                if (template) {
                    await supabase
                        .from('conversation_templates')
                        .update({ usage_count: template.usage_count + 1 })
                        .eq('id', templateId);
                }
            }

            return { success: true };

        } catch (error: any) {
            console.error('Error incrementing usage:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Search templates by name or tags
     */
    async searchTemplates(userId: string, query: string) {
        try {
            const { data, error } = await supabase
                .from('conversation_templates')
                .select('*')
                .or(`user_id.eq.${userId},is_public.eq.true`)
                .or(`name.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}}`)
                .order('usage_count', { ascending: false });

            if (error) throw error;

            return { success: true, data };

        } catch (error: any) {
            console.error('Error searching templates:', error);
            return { success: false, error: error.message };
        }
    }
}
