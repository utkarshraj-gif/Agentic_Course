// pages/SkillMapPage.tsx
import { ProgressService } from '../services/progress/ProgressService';
import { useEffect, useState } from 'react';

interface Skill {
  name: string;
  description: string;
  classes: number[];
}

const SKILLS: Skill[] = [
  { name: 'Foundations & Agent Design', description: 'Core agent concepts, prompt engineering, system design', classes: [1, 2] },
  { name: 'Retrieval & RAG', description: 'Embeddings, vector search, hybrid retrieval, RAG pipelines', classes: [3, 4] },
  { name: 'Tool Engineering', description: 'Function calling, MCP, external integrations', classes: [5] },
  { name: 'Memory & State', description: 'In-context, external, and semantic memory; LangGraph state', classes: [6] },
  { name: 'Evaluation', description: 'LangSmith, Opik, LLM-as-Judge, error analysis', classes: [7, 8] },
  { name: 'Agentic RAG & Performance', description: 'Agentic retrieval loops, fine-tuning, inference optimization', classes: [9, 10] },
  { name: 'Production & Observability', description: 'OpenTelemetry, guardrails, observability pipelines', classes: [11] },
  { name: 'Multi-Agent Systems', description: 'A2A protocol, coordination, deployment', classes: [12] },
];

function SkillBar({ skill }: { skill: Skill }) {
  const done = skill.classes.filter(id => ProgressService.isLessonComplete(id)).length;
  const pct = skill.classes.length > 0 ? Math.round((done / skill.classes.length) * 100) : 0;

  return (
    <div className="skill-row">
      <div className="skill-row-left">
        <div className="skill-name">{skill.name}</div>
        <div className="skill-desc">{skill.description}</div>
      </div>
      <div className="skill-row-right">
        <div className="skill-bar">
          <div
            className="skill-bar-fill"
            style={{ width: `${pct}%` }}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
        <span className="skill-pct">{pct}%</span>
      </div>
    </div>
  );
}

export function SkillMapPage() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener('progress_updated', handler);
    return () => window.removeEventListener('progress_updated', handler);
  }, []);

  const overallPct = Math.round(
    SKILLS.reduce((acc, s) => {
      const done = s.classes.filter(id => ProgressService.isLessonComplete(id)).length;
      return acc + (done / s.classes.length) * 100;
    }, 0) / SKILLS.length
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Skill Map</h1>
          <p className="page-subtitle">
            Your progress across {SKILLS.length} skill areas. Derived from completed lessons.
          </p>
        </div>
        <div className="skill-overall">
          <span className="skill-overall-label">Overall mastery</span>
          <span className="skill-overall-pct">{overallPct}%</span>
        </div>
      </div>

      <div className="skill-map-card">
        <div className="skill-list">
          {SKILLS.map(skill => (
            <SkillBar key={skill.name} skill={skill} />
          ))}
        </div>
      </div>

      <div className="skill-map-note">
        <p>Skill levels increase automatically as you complete lessons and knowledge checks. Complete all classes to reach full mastery.</p>
      </div>
    </div>
  );
}
