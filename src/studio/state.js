// Shared mutable state for the Studio content script

export let currentVideoId = null;
export let userShareToken = null;
export let annotations = [];
export let sidebar = null;
export let sidebarOpen = true;
export let collapseButton = null;
export let markersContainer = null;
export let navObserver = null;
export let initialized = false;

export function setCurrentVideoId(val) { currentVideoId = val; }
export function setUserShareToken(val) { userShareToken = val; }
export function setAnnotations(val) { annotations = val; }
export function setSidebar(val) { sidebar = val; }
export function setSidebarOpen(val) { sidebarOpen = val; }
export function setCollapseButton(val) { collapseButton = val; }
export function setMarkersContainer(val) { markersContainer = val; }
export function setNavObserver(val) { navObserver = val; }
export function setInitialized(val) { initialized = val; }
