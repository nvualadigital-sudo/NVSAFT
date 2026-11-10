import original from "./modelos-originais.html?raw";
export interface PassContext {
  companyId: string;
  website?: string;
  scope: string;
  parentOrigin: string;
  fields: Record<string, string>;
  logo: string;
  preferences: string | null;
}
export function passDocument(context: PassContext, vendorUrl: string) {
  const json = JSON.stringify(context).replace(/</g, "\\u003c");
  const bootstrap = `<script>
 const NV_PASS_DATA=${json};
 globalThis.__nvPassContext=NV_PASS_DATA;
 let nvPassPreference=NV_PASS_DATA.preferences;
 const NV_PASS_STORAGE={
  getItem:()=>nvPassPreference,
  setItem:(_key,value)=>{nvPassPreference=String(value);parent.postMessage({type:'nv-pass-preference',scope:NV_PASS_DATA.scope,value:nvPassPreference},NV_PASS_DATA.parentOrigin);},
  removeItem:()=>{nvPassPreference=null;parent.postMessage({type:'nv-pass-preference',scope:NV_PASS_DATA.scope,value:null},NV_PASS_DATA.parentOrigin);}
 };
 </script>`;
  return original.replace(
    '<script src="__NV_PASS_VENDOR__"></script>',
    bootstrap +
      `<script src="${vendorUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></script>`,
  );
}
