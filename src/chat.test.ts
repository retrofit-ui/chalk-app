import { describe, it } from 'vitest';

// Scaffolding only — behavior specs, no assertions yet. See sendMessage/buildGraphClickMessage/
// buildDrawSubmissionMessage/buildAnswerSubmitMessage in ./chat.ts. The LLM call is mocked by
// injecting a fake Anthropic client via SendMessageDeps.client (client.messages.stream(...) must
// return an async-iterable of stream events plus a finalMessage() resolving to a fake
// Anthropic.Message). Filled in after this scaffold is reviewed for coverage.

describe('sendMessage', () => {
  describe('terminal single-round turn', () => {
    it.todo('pushes the user message onto conversation.messages before making any API call');
    it.todo('sets the conversation title from the first user message when this is the first message');
    it.todo('does not overwrite an existing title on subsequent messages');
    it.todo('streams text deltas into the assistant message content incrementally as events arrive');
    it.todo('leaves the assistant message content as the full streamed text on a plain terminal turn');
    it.todo('records model, stopReason, and a debug object on the assistant message');
    it.todo('accumulates usage (input/output/cache-creation/cache-read tokens) onto conversation.usage');
    it.todo('accumulates estimated cost onto conversation.usage.costUsd across multiple calls');
    it.todo('injects ephemeral cache_control onto the last content block of the last prior message');
    it.todo('calls persist and refreshList after a successful terminal turn');
    it.todo('calls setActiveId once, right after the user message is pushed');
  });

  describe('plan extraction on terminal turns', () => {
    it.todo('strips the >>PLAN<<...>>END PLAN<< block from the assistant content when present');
    it.todo('stores the raw unstripped content in modifiedFromRawMessage when a plan block is present');
    it.todo('pushes the extracted plan text onto conversation.plans');
    it.todo('leaves content and plans untouched when no >>PLAN<< marker is present');
  });

  describe('tool_use round-trips', () => {
    it.todo('normalizes finalMessage content into text/tool_use blocks and sets message kind to tool-use');
    it.todo('calls agent.executeSkill with the tool name and input for each tool_use block');
    it.todo('pushes a tool-result user message with one tool_result block per tool_use call, in order');
    it.todo('reports "Unknown tool: <name>" as tool_result content when executeSkill is undefined');
    it.todo('reports "Unknown tool: <name>" as tool_result content when executeSkill has no handler for that name');
    it.todo('makes a follow-up API call (continues the round loop) after a tool_use round');
    it.todo('resolves normally once a follow-up round returns a terminal (non tool_use) response');
    it.todo('handles multiple tool_use blocks within a single assistant turn');
    it.todo('does not run plan extraction on a tool_use (non-terminal) round');
  });

  describe('MAX_TOOL_ROUNDS enforcement', () => {
    it.todo('stops after MAX_TOOL_ROUNDS consecutive tool_use rounds without a terminal reply');
    it.todo('sets a user-facing error message when MAX_TOOL_ROUNDS is exceeded');
    it.todo('still persists conversation state when MAX_TOOL_ROUNDS is exceeded');
    it.todo('does not exceed MAX_TOOL_ROUNDS API calls even if the mock always returns tool_use');
  });

  describe('error handling', () => {
    it.todo('sets the error message when the Anthropic client throws synchronously');
    it.todo('sets the error message when the stream rejects asynchronously mid-iteration');
    it.todo('retains the partial assistant message content already streamed before the error');
    it.todo('persists conversation state after an error');
    it.todo('clears any previous error at the start of a new call');
  });

  describe('tools wiring', () => {
    it.todo('omits the tools param entirely when agent.skills is empty');
    it.todo('passes agent.skills as the tools param when non-empty');
  });

  describe('client injection', () => {
    it.todo('uses the injected deps.client instead of constructing one via makeClient when provided');
  });
});

describe('buildGraphClickMessage', () => {
  it.todo('produces a singular "I clicked the point (x, y)" summary for exactly one point');
  it.todo('produces a bulleted multi-point summary for more than one point');
  it.todo('sets kind to graph-click and preserves the raw points array in graphClickData');
});

describe('buildDrawSubmissionMessage', () => {
  it.todo('produces a content array with a leading text block and a base64 image block');
  it.todo('sets kind to draw-submission and preserves the raw base64 string in drawSubmissionData');
});

describe('buildAnswerSubmitMessage', () => {
  it.todo('produces a bulleted "- identifier: value" summary line per answer');
  it.todo('sets kind to answer-submit and preserves the raw answers map in answerData');
});
