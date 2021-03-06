'use strict'

const browser = require('webextension-polyfill')

async function findUrlForContext (context) {
  if (context) {
    if (context.linkUrl) {
      // present when clicked on a link
      return context.linkUrl
    }
    if (context.srcUrl) {
      // present when clicked on page element such as image or video
      return context.srcUrl
    }
    if (context.pageUrl) {
      // pageUrl is the root frame
      return context.pageUrl
    }
  }
  // falback to the url of current tab
  const currentTab = await browser.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0])
  return currentTab.url
}

module.exports.findUrlForContext = findUrlForContext

const contextMenuAddToIpfsSelection = 'contextMenu_AddToIpfsSelection'
const contextMenuAddToIpfsRawCid = 'contextMenu_AddToIpfsRawCid'
const contextMenuAddToIpfsKeepFilename = 'contextMenu_AddToIpfsKeepFilename'
const contextMenuCopyCanonicalAddress = 'panelCopy_currentIpfsAddress'
const contextMenuCopyAddressAtPublicGw = 'panel_copyCurrentPublicGwUrl'

function createContextMenus (getState, runtime, ipfsPathValidator, { onAddToIpfs, onAddToIpfsKeepFilename, onCopyCanonicalAddress, onCopyAddressAtPublicGw }) {
  let copyAddressContexts = ['page', 'image', 'video', 'audio', 'link']
  if (runtime.isFirefox) {
    // https://github.com/ipfs-shipyard/ipfs-companion/issues/398
    copyAddressContexts.push('page_action')
  }
  try {
    browser.contextMenus.create({
      id: contextMenuAddToIpfsSelection,
      title: browser.i18n.getMessage(contextMenuAddToIpfsSelection),
      contexts: ['selection'],
      documentUrlPatterns: ['<all_urls>'],
      enabled: false,
      onclick: onAddToIpfs
    })

    browser.contextMenus.create({
      id: contextMenuAddToIpfsRawCid,
      title: browser.i18n.getMessage(contextMenuAddToIpfsRawCid),
      contexts: ['image', 'video', 'audio', 'link'],
      documentUrlPatterns: ['<all_urls>'],
      enabled: false,
      onclick: onAddToIpfs
    })

    browser.contextMenus.create({
      id: contextMenuAddToIpfsKeepFilename,
      title: browser.i18n.getMessage(contextMenuAddToIpfsKeepFilename),
      contexts: ['image', 'video', 'audio', 'link'],
      documentUrlPatterns: ['<all_urls>'],
      enabled: false,
      onclick: onAddToIpfsKeepFilename
    })

    browser.contextMenus.create({
      id: contextMenuCopyCanonicalAddress,
      title: browser.i18n.getMessage(contextMenuCopyCanonicalAddress),
      contexts: copyAddressContexts,
      documentUrlPatterns: ['*://*/ipfs/*', '*://*/ipns/*'],
      onclick: onCopyCanonicalAddress
    })

    browser.contextMenus.create({
      id: contextMenuCopyAddressAtPublicGw,
      title: browser.i18n.getMessage(contextMenuCopyAddressAtPublicGw),
      contexts: copyAddressContexts,
      documentUrlPatterns: ['*://*/ipfs/*', '*://*/ipns/*'],
      onclick: onCopyAddressAtPublicGw
    })
  } catch (err) {
    // documentUrlPatterns is not supported in Brave
    if (err.message.indexOf('createProperties.documentUrlPatterns of contextMenus.create is not supported yet') > -1) {
      console.warn('[ipfs-companion] Context menus disabled - createProperties.documentUrlPatterns of contextMenus.create is not supported yet')
      return { update: () => Promise.resolve() }
    }
    // contextMenus are not supported in Firefox for Android
    if (err.message === 'browser.contextMenus is undefined' || typeof browser.contextMenus === 'undefined') {
      console.warn('[ipfs-companion] Context menus disabled - browser.contextMenus is undefined')
      return { update: () => Promise.resolve() }
    }
    throw err
  }

  return {
    async update (changedTabId) {
      try {
        const canUpload = getState().peerCount > 0
        const items = [ contextMenuAddToIpfsSelection,
          contextMenuAddToIpfsRawCid,
          contextMenuAddToIpfsKeepFilename
        ]
        for (let item of items) {
          await browser.contextMenus.update(item, { enabled: canUpload })
        }
        if (changedTabId) {
          // recalculate tab-dependant menu items
          const currentTab = await browser.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0])
          if (currentTab && currentTab.id === changedTabId) {
            const ipfsContext = ipfsPathValidator.isIpfsPageActionsContext(currentTab.url)
            browser.contextMenus.update(contextMenuCopyCanonicalAddress, { enabled: ipfsContext })
            browser.contextMenus.update(contextMenuCopyAddressAtPublicGw, { enabled: ipfsContext })
          }
        }
      } catch (err) {
        console.log('[ipfs-companion] Error updating context menus', err)
      }
    }

    // TODO: destroy?
  }
}

module.exports.createContextMenus = createContextMenus
