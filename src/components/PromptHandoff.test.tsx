// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PromptHandoff } from './PromptHandoff'

afterEach(cleanup)

describe('PromptHandoff', () => {
  it('shows the exact handoff and discloses that local files must be reattached', () => {
    render(
      <PromptHandoff
        prompt="Research Escudo before generating."
        codexPrompt="Research and validate Escudo."
        chatGptUrl="https://chatgpt.com/?prompt=Research%20Escudo"
        hasPlannedFiles
      />,
    )

    expect(screen.getByText(/attachments stay behind/i)).toBeInTheDocument()
    expect(screen.getByText('Research Escudo before generating.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create in chatgpt/i })).toHaveAttribute('href', expect.stringContaining('chatgpt.com'))
    expect(screen.getByRole('button', { name: /copy for codex/i })).toBeInTheDocument()
  })
})
