const http = require('node:http');
const { URL } = require('node:url');
const ORIGIN = 'https://you-name-it-luxury.onrender.com';
const PORT = process.env.PORT || 10000;
const KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
const DAILY_LIMIT = 50;
let day = new Date().toISOString().slice(0,10);
let used = 0;
const system = `You are the friendly, professional English-language AI assistant for You Name It Luxury, a UAE luxury vehicle enquiry and marketing website. Answer normal customer questions conversationally and helpfully, including general questions that may not be in a prepared FAQ. Keep answers concise and clear. You may explain vehicle categories and general UAE travel/enquiry processes. Never invent prices, vehicle availability, supplier details, licences, service coverage, or booking confirmations. Do not claim the website itself rents vehicles, takes payment, or confirms bookings. The relevant licensed rental provider supplies vehicles and handles availability, final quotation, booking confirmation, payment and rental agreement. For prices, quotations, bookings or availability, explain that the team must check with a licensed provider and ask the customer to submit the enquiry form. If asked to speak to a human, reply exactly: "Please complete and submit our enquiry form. Our team will contact you on WhatsApp." Website enquiry form: https://you-name-it-luxury.onrender.com/#enquiry-form. WhatsApp: +971 56 968 5056. If unsure, be honest and direct the customer to the enquiry form. Do not provide legal, financial or safety-critical assurances.`;
function reply(res, status, data) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
const server = http.createServer(async (req,res) => {
 const origin = req.headers.origin;
 if (origin && origin !== ORIGIN) return reply(res,403,{error:'Origin not allowed'});
 if (req.method === 'OPTIONS') { res.writeHead(204, {'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}); return res.end(); }
 const url = new URL(req.url, 'http://localhost');
 if (req.method === 'GET' && url.pathname === '/health') return reply(res,200,{ok:true,service:'You Name It Luxury AI'});
 if (req.method !== 'POST' || url.pathname !== '/api/chat') return reply(res,404,{error:'Not found'});
 if (!KEY) return reply(res,503,{error:'The assistant is temporarily unavailable. Please complete and submit our enquiry form. Our team will contact you on WhatsApp.',fallback:true});
 const today = new Date().toISOString().slice(0,10); if (today !== day) {day=today; used=0;}
 if (used >= DAILY_LIMIT) return reply(res,429,{error:'Thank you for contacting You Name It Luxury. Our AI assistant has reached its free daily limit. Please complete and submit our enquiry form. Our team will contact you on WhatsApp.',fallback:true});
 let raw=''; for await (const chunk of req) { raw += chunk; if (raw.length > 20000) return reply(res,413,{error:'Message too long'}); }
 let body; try { body=JSON.parse(raw); } catch { return reply(res,400,{error:'Invalid request'}); }
 const messages = Array.isArray(body.messages) ? body.messages.slice(-12).filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string').map(m => ({role:m.role,content:m.content.slice(0,2000)})) : [];
 if (!messages.length || messages[messages.length-1].role !== 'user') return reply(res,400,{error:'Please enter a question.'});
 used++;
 try {
  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+KEY,'Content-Type':'application/json','HTTP-Referer':ORIGIN,'X-Title':'You Name It Luxury'},body:JSON.stringify({model:MODEL,messages:[{role:'system',content:system},...messages],temperature:0.6,max_tokens:450})});
  const data = await upstream.json().catch(()=>({}));
  if (!upstream.ok) { console.error('OpenRouter request failed:', upstream.status, JSON.stringify(data.error || data)); if (upstream.status===429 || upstream.status===402) return reply(res,429,{error:'Our free AI allowance is temporarily unavailable. Please complete and submit our enquiry form. Our team will contact you on WhatsApp.',fallback:true}); return reply(res,502,{error:'The assistant is temporarily unavailable. Please submit our enquiry form and our team will contact you on WhatsApp.',fallback:true}); }
  const answer=data.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) { console.error('OpenRouter returned no usable answer:', JSON.stringify({model:data.model,choices:data.choices,usage:data.usage})); return reply(res,502,{error:'The assistant could not prepare an answer. Please try again or submit the enquiry form.',fallback:true}); }
  return reply(res,200,{reply:answer.trim(),remaining:Math.max(0,DAILY_LIMIT-used)});
 } catch (err) { console.error('OpenRouter connection error:', err && err.message ? err.message : 'unknown error'); return reply(res,502,{error:'The assistant is temporarily unavailable. Please submit our enquiry form and our team will contact you on WhatsApp.',fallback:true}); }
});
server.listen(PORT,'0.0.0.0',()=>console.log('You Name It Luxury AI backend listening on '+PORT));
