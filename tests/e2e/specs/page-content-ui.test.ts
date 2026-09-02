describe('Content UI Injection', () => {
  it('should locate the injected study float ball host on example.com', async () => {
    await browser.url('https://example.com');

    const contentAllDiv = await $('#CEB-extension-all').getElement();
    await expect(contentAllDiv).toBeDisplayed();
  });
});
