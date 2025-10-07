let wakeLock = null;

export async function requestWakeLock(){
  try{
    if('wakeLock' in navigator){
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release',()=>{});
    }
  }catch(e){}
}

export function initWakeLock(){
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible' && (wakeLock?.released || !wakeLock)) requestWakeLock();
  });
}

