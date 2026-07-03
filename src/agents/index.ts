import type { Agent } from './types';
import ada from './ada/index';
import bernoulli from './bernoulli/index';

export const AGENTS: Agent[] = [ada, bernoulli];

export const AGENT_IDS = AGENTS.map((a) => a.id);

export function getAgent(id: string): Agent {
  return AGENTS.find((a) => a.id === id) ?? ada;
}
