describe('Webextension Side Panel', () => {
  it('should make side panel accessible', async () => {
    const extensionPath = await browser.getExtensionPath();
    const sidePanelUrl = `${extensionPath}/side-panel/index.html`;

    await browser.url(sidePanelUrl);
    await expect(browser).toHaveTitle('Side Panel');
    const heading = await $('h1*=Study Mind AI').getElement();
    await expect(heading).toBeExisting();
  });
});
