import '@testing-library/jest-dom/vitest'
import { clearToolState } from '@/hooks/useToolState'

// Tool state deliberately outlives components; isolate tests from each other
afterEach(clearToolState)
