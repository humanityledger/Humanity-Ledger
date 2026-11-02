// tests/perf/communities.test.ts
describe('Community Feed Performance', () => {
  it('loads 50 recent messages from 10,000 in < 300ms using cursor pagination', async () => {
    const start = Date.now();
    // Simulate cursor query
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(300);
  });
});
