describe('Webextension Content Script', () => {
  it('should log study mind content script loaded on any page', async () => {
    await browser.sessionSubscribe({ events: ['log.entryAdded'] });
    const logs: (string | null)[] = [];

    browser.on('log.entryAdded', logEntry => {
      logs.push(logEntry.text);
    });

    await browser.url('https://www.google.com');

    const EXPECTED_LOG_MESSAGE = '[Study Mind] Content script loaded';
    await browser.waitUntil(() => logs.includes(EXPECTED_LOG_MESSAGE));

    expect(logs).toContain(EXPECTED_LOG_MESSAGE);
  });
});
