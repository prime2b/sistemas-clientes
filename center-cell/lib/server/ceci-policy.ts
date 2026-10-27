export function shouldRestartWithCeci(conversation:{status:string;assigned:string},enabled:boolean,hasText:boolean,agentHasReplied:boolean,sharedInbox=false){
  if(sharedInbox)return false;
  if(!enabled||!hasText)return false;
  if(conversation.status==='closed')return true;
  return conversation.status==='human'&&!conversation.assigned&&!agentHasReplied;
}
