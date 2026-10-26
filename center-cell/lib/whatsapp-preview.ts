export type PreviewMessage={id:string;role:string;body:string;created:number;pending?:boolean};
/** WhatsApp transport is currently text-only. Never expose internal notes or admin cards to this view. */
export function whatsappPreviewMessages(messages:PreviewMessage[]){
 return messages.filter(message=>['user','assistant','agent'].includes(message.role)&&typeof message.body==='string');
}
