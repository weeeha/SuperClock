// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { z } from 'zod';
import { SchemaForm } from './schema-form';

afterEach(cleanup);

const schema = z.object({ when: z.string().default('') });

describe('SchemaForm string formats', () => {
  it("renders format: 'date' as a native date input holding YYYY-MM-DD", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SchemaForm
        schema={schema}
        meta={{ when: { format: 'date', label: 'When' } }}
        value={{ when: '2027-03-10' }}
        onChange={onChange}
      />,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2027-03-10');
    fireEvent.change(input, { target: { value: '2027-04-01' } });
    expect(onChange).toHaveBeenCalledWith({ when: '2027-04-01' });
  });

  it('allows an empty date', () => {
    const { container } = render(
      <SchemaForm schema={schema} meta={{ when: { format: 'date' } }} value={{ when: '' }} onChange={() => {}} />,
    );
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('');
  });
});
