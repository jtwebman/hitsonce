// The first-party tracker snippet, served (with the collector path injected) at the
// collector GET endpoint. It posts a small JSON beacon on each pageview, including
// SPA navigations. Kept tiny and dependency-free.
export function renderTracker(collectorPath: string): string {
  const p = JSON.stringify(collectorPath);
  return `(function(){var P=${p};function s(n){try{var b=JSON.stringify({n:n,path:location.pathname+location.search,ref:document.referrer||null,lang:navigator.language||null,tz:Intl.DateTimeFormat().resolvedOptions().timeZone||null,w:screen.width||null,h:screen.height||null});if(navigator.sendBeacon){navigator.sendBeacon(P,b)}else{fetch(P,{method:"POST",body:b,keepalive:true})}}catch(e){}}s("pageview");var h=history.pushState;history.pushState=function(){h.apply(this,arguments);s("pageview")};addEventListener("popstate",function(){s("pageview")})})();`;
}
