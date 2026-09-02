describe('Webextension Popup', () => {
  it('should open the popup successfully', async () => {
    const extensionPath = await browser.getExtensionPath();
    const popupUrl = `${extensionPath}/popup/index.html`;
    await browser.url(popupUrl);

    await expect(browser).toHaveTitle('Popup');
    const heading = await $('h1*=Study Mind AI').getElement();
    await expect(heading).toBeExisting();
  });
});
