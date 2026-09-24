// data/quizData.ts
// Knowledge check questions derived from actual class content

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ClassQuiz {
  classId: number;
  questions: QuizQuestion[];
}

export const QUIZ_DATA: ClassQuiz[] = [
  {
    classId: 1,
    questions: [
      {
        id: '1-1',
        question: 'What distinguishes an AI agent from a simple AI model?',
        options: [
          'An agent uses larger language models',
          'An agent can plan, use tools, and take multi-step actions to achieve a goal',
          'An agent is always connected to the internet',
          'An agent only works with text data',
        ],
        correctIndex: 1,
        explanation: 'Agents differ from simple models because they can reason, plan, invoke tools, and take sequential actions — not just produce a single output.',
      },
      {
        id: '1-2',
        question: 'Which framework is primarily used in this course for building stateful agent workflows?',
        options: ['AutoGen', 'CrewAI', 'LangGraph', 'Semantic Kernel'],
        correctIndex: 2,
        explanation: 'LangGraph is used throughout this course to build stateful, graph-based agent workflows with checkpointing and human-in-the-loop support.',
      },
    ],
  },
  {
    classId: 2,
    questions: [
      {
        id: '2-1',
        question: 'What is the primary purpose of a system prompt in an agent design?',
        options: [
          'To store the agent\'s memory across sessions',
          'To set the agent\'s identity, constraints, and behavioral guidelines',
          'To define the external tools available to the agent',
          'To compress the input context',
        ],
        correctIndex: 1,
        explanation: 'System prompts establish the agent\'s persona, constraints, output format, and guardrails — they are the primary behavioral lever in prompt engineering.',
      },
      {
        id: '2-2',
        question: 'DSPy differs from traditional prompt engineering primarily by:',
        options: [
          'Using larger models by default',
          'Automatically optimizing prompts using training examples',
          'Requiring no LLM at all',
          'Only working with OpenAI models',
        ],
        correctIndex: 1,
        explanation: 'DSPy compiles and optimizes prompts automatically using a small set of examples, rather than requiring hand-crafted prompt strings.',
      },
    ],
  },
  {
    classId: 3,
    questions: [
      {
        id: '3-1',
        question: 'What is the primary purpose of retrieval in a RAG system?',
        options: [
          'To fine-tune the language model on new data',
          'To reduce the token cost of each API call',
          'To ground the model\'s response in relevant external knowledge',
          'To speed up inference time',
        ],
        correctIndex: 2,
        explanation: 'RAG (Retrieval-Augmented Generation) retrieves relevant documents from an external knowledge base to ground the LLM\'s answer in factual, current information.',
      },
      {
        id: '3-2',
        question: 'Which library is used for fast approximate nearest-neighbor vector search in Class 3?',
        options: ['Chroma DB', 'Pinecone', 'FAISS', 'Weaviate'],
        correctIndex: 2,
        explanation: 'FAISS (Facebook AI Similarity Search) is used for efficient dense vector retrieval in this class.',
      },
    ],
  },
  {
    classId: 4,
    questions: [
      {
        id: '4-1',
        question: 'What is hybrid search in RAG design?',
        options: [
          'Using two different LLMs simultaneously',
          'Combining dense vector similarity with sparse keyword (BM25) retrieval',
          'Retrieving from both SQL and NoSQL databases',
          'Running retrieval on both CPU and GPU',
        ],
        correctIndex: 1,
        explanation: 'Hybrid search combines dense embeddings (semantic similarity) with BM25 sparse keyword matching, improving recall for both semantic and exact-match queries.',
      },
    ],
  },
  {
    classId: 5,
    questions: [
      {
        id: '5-1',
        question: 'In LangGraph, what is an "edge" in the context of agent tool use?',
        options: [
          'A database connection',
          'A transition between graph nodes that determines next execution step',
          'An API rate limit boundary',
          'A type of memory store',
        ],
        correctIndex: 1,
        explanation: 'In LangGraph, edges define the conditional or unconditional transitions between nodes, controlling the agent\'s execution flow.',
      },
    ],
  },
  {
    classId: 6,
    questions: [
      {
        id: '6-1',
        question: 'What does MCP stand for in the context of Class 6?',
        options: [
          'Multi-Chain Protocol',
          'Model Context Protocol',
          'Memory Compression Pipeline',
          'Multi-Component Processing',
        ],
        correctIndex: 1,
        explanation: 'MCP (Model Context Protocol) is a standard for connecting agents to external tool servers, enabling structured tool discovery and invocation.',
      },
      {
        id: '6-2',
        question: 'Which type of memory persists across multiple agent sessions?',
        options: [
          'In-context memory (conversation history)',
          'External memory via LangMem or Redis',
          'Working memory within a single graph run',
          'Embedding cache',
        ],
        correctIndex: 1,
        explanation: 'External memory stores like LangMem backed by Redis persist across sessions, unlike in-context or working memory which is ephemeral.',
      },
    ],
  },
  {
    classId: 7,
    questions: [
      {
        id: '7-1',
        question: 'What is LangSmith primarily used for in agent evaluation?',
        options: [
          'Deploying agents to production',
          'Fine-tuning language models',
          'Tracing, logging, and evaluating agent runs end-to-end',
          'Compressing embeddings',
        ],
        correctIndex: 2,
        explanation: 'LangSmith provides observability into agent traces, allowing you to evaluate outputs, compare runs, and identify failure modes systematically.',
      },
    ],
  },
  {
    classId: 8,
    questions: [
      {
        id: '8-1',
        question: 'In the "LLM as Judge" pattern, what does the judge LLM evaluate?',
        options: [
          'The latency of the production agent',
          'The quality, relevance, or correctness of another model\'s output',
          'The cost per token of the primary model',
          'The security of the deployed endpoint',
        ],
        correctIndex: 1,
        explanation: 'LLM-as-Judge uses a separate LLM to score or critique outputs from a primary model, enabling scalable automated quality assessment.',
      },
    ],
  },
  {
    classId: 9,
    questions: [
      {
        id: '9-1',
        question: 'What is the key advantage of Agentic RAG over standard RAG?',
        options: [
          'It uses larger embedding models',
          'The agent can iteratively re-query, re-rank, and reason about retrieved documents',
          'It stores all documents in memory',
          'It avoids the need for a vector database',
        ],
        correctIndex: 1,
        explanation: 'Agentic RAG allows the agent to reflect on retrieval quality, issue follow-up queries, and combine reasoning with retrieval in a loop — unlike one-shot standard RAG.',
      },
    ],
  },
  {
    classId: 10,
    questions: [
      {
        id: '10-1',
        question: 'What does vLLM provide that standard Hugging Face inference does not?',
        options: [
          'Fine-tuning capabilities',
          'A visual interface for models',
          'PagedAttention for high-throughput, memory-efficient LLM serving',
          'RAG pipeline integration',
        ],
        correctIndex: 2,
        explanation: 'vLLM uses PagedAttention to efficiently manage KV cache, enabling significantly higher throughput and lower latency for concurrent LLM inference.',
      },
    ],
  },
  {
    classId: 11,
    questions: [
      {
        id: '11-1',
        question: 'What does OpenTelemetry provide for agent observability?',
        options: [
          'A UI dashboard for model outputs',
          'Standardized traces, metrics, and logs that can be exported to any compatible backend',
          'A fine-tuning pipeline',
          'A token pricing calculator',
        ],
        correctIndex: 1,
        explanation: 'OpenTelemetry provides vendor-neutral, standardized instrumentation for distributed tracing, metrics, and logs — essential for production agent observability.',
      },
    ],
  },
  {
    classId: 12,
    questions: [
      {
        id: '12-1',
        question: 'What does the A2A (Agent-to-Agent) Protocol enable?',
        options: [
          'Agents to share GPU memory',
          'Structured communication and task delegation between independent agent systems',
          'Automatic model selection',
          'Cross-cloud database replication',
        ],
        correctIndex: 1,
        explanation: 'The A2A Protocol defines a standard interface for agents to discover, communicate with, and delegate tasks to other agents in a multi-agent system.',
      },
    ],
  },
  {
    classId: 13,
    questions: [
      {
        id: '13-1',
        question: 'What is the primary difference between a direct and an indirect prompt injection?',
        options: [
          'Direct injections use encrypted text, while indirect injections use plain English',
          'Direct injections are sent directly in user prompts, while indirect injections are hidden in untrusted external data retrieved by the agent',
          'Indirect injections only affect open-source models',
          'Direct injections can only target vector databases',
        ],
        correctIndex: 1,
        explanation: 'Indirect prompt injections occur when malicious instructions are embedded in external documents (e.g. emails, PDFs, web pages) processed by the agent.',
      },
      {
        id: '13-2',
        question: 'What is the function of a "canary token" in agent security?',
        options: [
          'To increase inference speed of the model',
          'To detect data exfiltration breaches if secret tokens appear in unauthorized model outputs',
          'To fine-tune embedding weights',
          'To compress context windows',
        ],
        correctIndex: 1,
        explanation: 'Canary tokens are unique secret identifiers placed in sensitive state; if detected in an outbound response, the system halts the breach immediately.',
      },
    ],
  },
  {
    classId: 14,
    questions: [
      {
        id: '14-1',
        question: 'What is the primary operational advantage of vLLM Continuous Batching over traditional batching?',
        options: [
          'It eliminates the need for GPU hardware',
          'It dynamically iterates at the token level, preventing idle GPU cores when requests have different output lengths',
          'It converts text directly into audio',
          'It only works with proprietary APIs',
        ],
        correctIndex: 1,
        explanation: 'Continuous batching schedules new tokens dynamically across concurrent streams, dramatically boosting aggregate GPU throughput and minimizing idle wait.',
      },
      {
        id: '14-2',
        question: 'When is a self-hosted open-weights model typically more cost-effective than cloud proprietary APIs?',
        options: [
          'When processing fewer than 1,000 queries per month',
          'When query volume is sustained and high (e.g., millions of tokens daily), where fixed GPU infrastructure costs undercut linear per-token API rates',
          'Only when models are smaller than 1 billion parameters',
          'When zero GPUs are available',
        ],
        correctIndex: 1,
        explanation: 'At high sustained enterprise volumes, dedicated GPU clusters on reserved instances have a lower Total Cost of Ownership than linear per-million-token API fees.',
      },
    ],
  },
  {
    classId: 15,
    questions: [
      {
        id: '15-1',
        question: 'In LangGraph, what mechanism allows a state graph to pause for human approval and resume later?',
        options: [
          'Calling time.sleep() on the main web server process',
          'Thread checkpointing combined with the interrupt() directive, saving state to a persistent store',
          'Deleting the database session',
          'Re-prompting the user from scratch',
        ],
        correctIndex: 1,
        explanation: 'LangGraph uses persistent checkpoints (e.g. in PostgreSQL) and interrupt() to pause graph execution and resume exactly where it left off upon human sign-off.',
      },
      {
        id: '15-2',
        question: 'What is the purpose of an immutable audit trail in a Human-in-the-Loop agent workflow?',
        options: [
          'To speed up model quantization',
          'To provide a tamper-evident record of agent reasoning, tool payloads, and human override decisions for compliance and liability auditing',
          'To replace the vector database',
          'To generate random responses',
        ],
        correctIndex: 1,
        explanation: 'Audit trails log cryptographic signatures of prompts, tool calls, and human approvals so regulated enterprises can satisfy strict compliance and governance audits.',
      },
    ],
  },
];

export function getQuizForClass(classId: number): ClassQuiz | null {
  return QUIZ_DATA.find(q => q.classId === classId) ?? null;
}
