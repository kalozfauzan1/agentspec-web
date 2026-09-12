/**
 * AI Service Client using OmniRoute (OpenAI-compatible endpoint)
 * Implements PRD Section 33: AI Generation Architecture
 */

const API_BASE_URL = 'https://9router.nalarlabs.tech/v1';
const API_KEY = process.env.NEXT_PUBLIC_9ROUTER_API_KEY || '';

// Model configuration for different tasks
const MODELS = {
  ANALYSIS: 'first',
  CLARIFICATION: 'first',
  PRD: 'first',
  FEATURES: 'first',
  ARCHITECTURE: 'first',
  TASKS: 'first',
  AGENT_INSTRUCTIONS: 'first',
  EDIT: 'first'
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIPrompt {
  model: string;
  messages: ChatMessage[];
  response_format?: { type: 'json_object' };
  temperature?: number;
}

interface AIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class AIService {
  private async callAPI(prompt: AIPrompt): Promise<string> {
    if (!API_KEY) {
      throw new Error('9Router API key is not configured. Set NEXT_PUBLIC_9ROUTER_API_KEY environment variable.');
    }

    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: prompt.model,
        messages: prompt.messages,
        response_format: prompt.response_format,
        temperature: prompt.temperature ?? 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error: ${response.status} - ${error}`);
    }

    const data: AIResponse = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  async analyzeIdea(idea: string): Promise<any> {
    const prompt: AIPrompt = {
      model: MODELS.ANALYSIS,
      messages: [
        {
          role: 'system',
          content: `You are a product analyst. Analyze the user's software idea and identify:
- Product type and purpose
- Target users and roles
- Core features
- Technical preferences
- Business rules
- Important ambiguities that need clarification
- Explicit constraints and exclusions

Respond in JSON format only, no other text:
{"productType":"string","purpose":"string","targetUsers":["string"],"roles":["string"],"coreFeatures":["string"],"technicalPreferences":{"platform":["web","mobile"],"frontend":"string","backend":"string","database":"string"},"businessRules":["string"],"ambiguities":["string"],"constraints":["string"],"nonGoals":["string"]}`
        },
        {
          role: 'user',
          content: idea
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5
    };

    const result = await this.callAPI(prompt);
    try {
      return JSON.parse(result);
    } catch (e) {
      // Try to extract JSON from response
      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error('Failed to parse analysis');
    }
  }

  async generateClarificationQuestions(idea: string, analysis: any): Promise<any[]> {
    const prompt: AIPrompt = {
      model: MODELS.CLARIFICATION,
      messages: [
        {
          role: 'system',
          content: `You are a product manager helping clarify software requirements.
Based on the idea and analysis, generate clarification questions that focus on decisions affecting product behavior or implementation.

Return a JSON array of questions:
[
  {
    "id": "question_id",
    "question": "Clear question text",
    "description": "Context for the question",
    "type": "radio|checkbox|text",
    "options": ["option1", "option2"]
  }
]`
        },
        {
          role: 'user',
          content: `Idea: ${idea}\n\nAnalysis: ${JSON.stringify(analysis, null, 2)}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    };

    const result = await this.callAPI(prompt);
    const parsed = JSON.parse(result);
    // Handle case where AI returns single object instead of array
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  async generatePRD(projectDefinition: any): Promise<string> {
    const prompt: AIPrompt = {
      model: MODELS.PRD,
      messages: [
        {
          role: 'system',
          content: `Generate a comprehensive PRD based on the project definition.
Include: Product Overview, Problem Statement, Product Goals, Target Users, User Roles, Core Features, Functional Requirements, User Flows, Business Rules, Edge Cases, Non-Functional Requirements, Non-Goals, MVP Scope.

Write in clear, structured Markdown. Return only the PRD content, no code fences or backticks.`
        },
        {
          role: 'user',
          content: JSON.stringify(projectDefinition, null, 2)
        }
      ]
    };

    const result = await this.callAPI(prompt);
    // Strip markdown code fences if present
    return result.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  async generateFeatures(projectDefinition: any): Promise<any[]> {
    const prompt: AIPrompt = {
      model: MODELS.FEATURES,
      messages: [
        {
          role: 'system',
          content: `Generate detailed feature specifications for each core feature.
Each feature should include: Name, Purpose, Actors, Main Flow, Requirements, Business Rules, Edge Cases, Acceptance Criteria.
Assign stable identifiers (FEATURE-001, FEATURE-002, etc.).

Return ONLY a JSON array, no other text.`
        },
        {
          role: 'user',
          content: JSON.stringify(projectDefinition, null, 2)
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6
    };

    const result = await this.callAPI(prompt);
    try {
      const parsed = JSON.parse(result);
      // Ensure we get an array
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      // Try to extract JSON from the response
      const match = result.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {}
      }
      return [];
    }
  }

  async generateArchitecture(projectDefinition: any): Promise<any> {
    const prompt: AIPrompt = {
      model: MODELS.ARCHITECTURE,
      messages: [
        {
          role: 'system',
          content: `Generate technical architecture recommendations based on requirements and user preferences.
Include: Frontend, Backend, Database, Authentication, Storage, Realtime, External Services, System Boundaries, High-level Data Flow.

Distinguish between:
- "User Selected" - explicitly chosen
- "Recommended" - selected by AgentSpec
- "Undecided" - not yet decided

Return JSON only, no code fences or backticks.`
        },
        {
          role: 'user',
          content: JSON.stringify(projectDefinition, null, 2)
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6
    };

    const result = await this.callAPI(prompt);
    try {
      return JSON.parse(result);
    } catch (e) {
      // Try to extract JSON from response
      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error('Failed to parse architecture');
    }
  }

  async generateTasks(projectDefinition: any, features: any[]): Promise<any[]> {
    const prompt: AIPrompt = {
      model: MODELS.TASKS,
      messages: [
        {
          role: 'system',
          content: `Generate implementation tasks following frontend-first strategy by default.
Each task must include: id, title, type (frontend/backend), featureId, dependencies, references, requirements, acceptanceCriteria.

Default order:
1. Project Foundation
2. Frontend Foundation
3. Frontend Features
4. Frontend Completion
5. Backend Foundation
6. Backend Features
7. Integration
8. Testing

Return ONLY a JSON array, no other text.`
        },
        {
          role: 'user',
          content: JSON.stringify({ projectDefinition, features }, null, 2)
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6
    };

    const result = await this.callAPI(prompt);
    try {
      const parsed = JSON.parse(result);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      const match = result.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {}
      }
      return [];
    }
  }

  async generateAgentInstructions(projectDefinition: any, tasks: any[]): Promise<string> {
    const prompt: AIPrompt = {
      model: MODELS.AGENT_INSTRUCTIONS,
      messages: [
        {
          role: 'system',
          content: `Generate AGENTS.md instructions for the coding agent.
Include: Project Overview, Source of Truth, Technology Stack, Architecture Rules, Implementation Strategy, Scope Rules, Coding Guidelines, Testing Expectations, Task Execution Workflow.

For frontend-first strategy, include rules about completing frontend before backend, using mock services, etc.

Return only the instructions content, no code fences or backticks.`
        },
        {
          role: 'user',
          content: JSON.stringify({ projectDefinition, tasks }, null, 2)
        }
      ]
    };

    const result = await this.callAPI(prompt);
    // Strip markdown code fences if present
    return result.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  async editSpecification(currentContent: string, instruction: string): Promise<string> {
    const prompt: AIPrompt = {
      model: MODELS.EDIT,
      messages: [
        {
          role: 'system',
          content: `You are a specification editor. Modify the provided specification based on the user's instruction while maintaining consistency with the overall project definition.

Apply changes carefully and maintain structure.`
        },
        {
          role: 'user',
          content: `Current Specification:\n${currentContent}\n\nInstruction: ${instruction}`
        }
      ]
    };

    return this.callAPI(prompt);
  }
}

export const aiService = new AIService();
