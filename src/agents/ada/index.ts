import type { Agent } from '../types';
import Harness from './harness';
import { adaConfig } from './agentConfig';

const ada: Agent = { ...adaConfig, Harness };

export default ada;
