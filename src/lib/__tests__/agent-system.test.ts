// Tests for the Agent system core classes
import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock the aiService module
vi.mock('../services/aiService.js', () => ({
  aiService: {
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}))

// Import after mock
const { BaseAgent } = await import('../agents/baseAgent.js')
const { AgentOrchestrator } = await import('../agents/baseAgent.js')

describe('BaseAgent', () => {
  let agent: InstanceType<typeof BaseAgent>

  beforeEach(() => {
    agent = new BaseAgent('TestAgent')
  })

  test('initializes with correct default state', () => {
    expect(agent.name).toBe('TestAgent')
    expect(agent.status).toBe('idle')
    expect(agent.progress).toBe(0)
    expect(agent.result).toBeNull()
    expect(agent.error).toBeNull()
    expect(agent.aiOptimizationsEnabled).toBe(false)
  })

  test('setStatus updates status and emits event', () => {
    const handler = vi.fn()
    agent.on('statusChange', handler)

    agent.setStatus('running', 50)

    expect(agent.status).toBe('running')
    expect(agent.progress).toBe(50)
    expect(handler).toHaveBeenCalledWith({
      agent: 'TestAgent',
      status: 'running',
      progress: 50,
    })
  })

  test('setResult sets result and marks completed', () => {
    const handler = vi.fn()
    agent.on('completed', handler)

    const mockResult = { files: ['test.js'] }
    agent.setResult(mockResult)

    expect(agent.result).toEqual(mockResult)
    expect(agent.status).toBe('completed')
    expect(agent.progress).toBe(100)
    expect(handler).toHaveBeenCalledWith({
      agent: 'TestAgent',
      result: mockResult,
    })
  })

  test('setError sets error and emits event', () => {
    const handler = vi.fn()
    agent.on('error', handler)

    const mockError = new Error('Something failed')
    agent.setError(mockError)

    expect(agent.error).toBe(mockError)
    expect(agent.status).toBe('error')
    expect(handler).toHaveBeenCalledWith({
      agent: 'TestAgent',
      error: mockError,
    })
  })

  test('on() returns unsubscribe function', () => {
    const handler = vi.fn()
    const unsubscribe = agent.on('statusChange', handler)

    agent.setStatus('running')
    expect(handler).toHaveBeenCalledTimes(1)

    unsubscribe()
    agent.setStatus('completed')
    expect(handler).toHaveBeenCalledTimes(1) // Not called again
  })

  test('multiple listeners for same event all fire', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    agent.on('statusChange', handler1)
    agent.on('statusChange', handler2)

    agent.setStatus('running')

    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  test('enableAIOptimizations initializes aiService once', async () => {
    await agent.enableAIOptimizations()
    expect(agent.aiOptimizationsEnabled).toBe(true)

    // Second call should not re-initialize
    const { aiService } = await import('../services/aiService.js')
    await agent.enableAIOptimizations()
    expect(aiService.initialize).toHaveBeenCalledTimes(1)
  })
})

describe('AgentOrchestrator', () => {
  let orchestrator: InstanceType<typeof AgentOrchestrator>

  beforeEach(() => {
    orchestrator = new AgentOrchestrator()
  })

  test('initializes with empty agents map', () => {
    expect(orchestrator.getAgents()).toEqual([])
  })

  test('register adds an agent', () => {
    const agent = new BaseAgent('TestAgent')
    orchestrator.register(agent)
    expect(orchestrator.getAgents()).toContain('TestAgent')
  })

  test('getAgent retrieves registered agent', () => {
    const agent = new BaseAgent('TestAgent')
    orchestrator.register(agent)
    expect(orchestrator.getAgent('TestAgent')).toBe(agent)
  })

  test('getAgent returns undefined for unregistered agent', () => {
    expect(orchestrator.getAgent('NonExistent')).toBeUndefined()
  })

  test('executeWorkflow returns success for simple workflow', async () => {
    const agent = new BaseAgent('TestAgent')
    orchestrator.register(agent)

    const result = await orchestrator.executeWorkflow('test-workflow', {
      agents: ['TestAgent'],
    })

    expect(result.success).toBe(true)
    expect(result.workflowId).toBe('test-workflow')
  })
})
