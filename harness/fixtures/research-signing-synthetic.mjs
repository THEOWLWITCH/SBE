// Invented protocol transport. This fixture never reads operational credentials
// or makes a network call; evidence is a test double, not legal verification.
import {randomUUID,createHash} from 'node:crypto';
import {contentHash} from '../lib/research-partnership-exports.mjs';
export function syntheticSignWell(){
 const state={creates:0,sends:0,reads:0,document:null,status:'Draft',loseCreate:false,loseSend:false,fullEvidence:false,mutation:null,beforeCreate:null};
 const policy={approved:true,institutionRequirementsReviewed:true,version:'synthetic-policy-v1',signerAuthorities:[{name:'Synthetic Owner',email:'owner@example.invalid',authority:'Synthetic owner authority'},{name:'Synthetic Partner',email:'partner@example.invalid',authority:'Synthetic partner authority'}]};
 const options={signingEnabled:true,env:{},signingProvider:'signwell',signing:{apiKey:'synthetic-not-live-never-a-secret',testMode:false},signingPolicy:policy,signwellAssurance:{operational:true,version:'synthetic-assurance-v1',policyHash:contentHash(policy),capabilities:{identity:true,authority:true,consent:true,certificate:true,delivery:true},verify:async input=>state.fullEvidence?{...Object.fromEntries(['provider','providerSessionId','recordId','versionId','documentHash','providerDocumentHash','authorityPolicyHash','assuranceVersion','finalDocumentHash'].map(k=>[k,input[k]])),completedAt:new Date(Date.now()-1000).toISOString(),certificateVerified:true,deliveryVerified:true,auditCertificate:Buffer.from('%PDF-1.7\nSynthetic independent audit certificate'),verifiedSigners:input.expectedSigners.map(p=>({...p,identityVerified:true,authorityVerified:true,consent:true,signedAt:new Date(Date.now()-2000).toISOString()}))}:null},signingFetchImpl:async(url,init)=>{
  if(!url.startsWith('https://www.signwell.com/api/v1/'))throw new Error('synthetic unexpected origin');
  if(init.method==='POST'&&url.endsWith('/documents')){
   state.creates++;await state.beforeCreate?.();const body=JSON.parse(init.body);if(body.draft!==true)throw new Error('synthetic must be draft');
   const bytes=Buffer.from(body.files[0].file_base64,'base64');state.sourceHash=createHash('sha256').update(bytes).digest('hex');state.sourceName=body.files[0].name;
   state.document={id:randomUUID(),test_mode:body.test_mode,embedded_signing:body.embedded_signing,allow_reassign:body.allow_reassign,metadata:body.metadata,recipients:body.recipients.map(p=>({...p,embedded_signing_url:'https://www.signwell.com/docs/synthetic_'+p.id+'/',passcode:'synthetic-private-passcode'}))};
   if(state.loseCreate)throw new Error('synthetic lost create response with private data');
  }else if(init.method==='POST'&&url.endsWith('/send')){state.sends++;state.status='Sent';if(state.loseSend)throw new Error('synthetic lost send response');}
  else if(url.includes('/completed_pdf?'))return new Response('%PDF-1.7\nSynthetic executed agreement',{headers:{'content-type':'application/pdf'}});
  else state.reads++;
  return Response.json({...state.document,status:state.status,...state.mutation});
 }};
 return {options,state};
}
