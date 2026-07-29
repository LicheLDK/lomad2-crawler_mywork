import {
  canTransitionStatus,
  selectableWorkflowStatuses,
} from './investigation.workflow';

describe('investigation.workflow', () => {
  it('matches the frontend one-step forward graph', () => {
    expect(canTransitionStatus('Open', 'Investigating')).toBe(true);
    expect(canTransitionStatus('Investigating', 'Review')).toBe(true);
    expect(canTransitionStatus('Review', 'Completed')).toBe(true);
    expect(canTransitionStatus('Completed', 'Archived')).toBe(true);

    expect(canTransitionStatus('Open', 'Review')).toBe(false);
    expect(canTransitionStatus('Open', 'Completed')).toBe(false);
    expect(canTransitionStatus('Investigating', 'Open')).toBe(false);
    expect(canTransitionStatus('Archived', 'Completed')).toBe(false);
  });

  it('exposes current + next for selectable statuses', () => {
    expect(selectableWorkflowStatuses('Open')).toEqual([
      'Open',
      'Investigating',
    ]);
    expect(selectableWorkflowStatuses('Completed')).toEqual([
      'Completed',
      'Archived',
    ]);
    expect(selectableWorkflowStatuses('Archived')).toEqual(['Archived']);
  });
});
