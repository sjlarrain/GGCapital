#!/usr/bin/env node
// READ-ONLY dry-run of the v2 import logic. Touches no database.
// Mirrors import_bbdd.mjs resolution to verify match rate + no stray companies.

import { readFileSync } from 'fs'
import { join } from 'path'
const BBDD = join(process.cwd(), 'BBDD')

function pl(l){const f=[];let c='',q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(ch==='"'){if(q&&l[i+1]==='"'){c+='"';i++}else q=!q}else if(ch===','&&!q){f.push(c);c=''}else c+=ch}f.push(c);return f}
function pc(raw){const ls=raw.replace(/^﻿/,'').split('\n');const h=pl(ls[0]).map(x=>x.trim());const o=[];for(let i=1;i<ls.length;i++){if(!ls[i].trim())continue;const v=pl(ls[i]);const r={};h.forEach((k,j)=>r[k]=(v[j]??'').trim());o.push(r)}return o}
function nn(s){return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim()}

const CANONICAL_NAMES = {
  'arpegio vc':'Arpegio','besant capital':'Besant VC','das calendar':'Das calendar','fintechlab':'FintechLab',
  'manutara':'Manutara Ventures','puramente':'PuraMente','ssv':'SSV VC','savia':'Savia VC','savia ventures':'Savia VC',
  'verve vc':'Verve','vor-tex':'Vor-Tex','wareclouds':'WareClouds','globalplanet.oi':'GlobalPlanet.io','globalplanet.io':'GlobalPlanet.io',
  '1616 ventures':'1616','bventures':'BVC','blustone':'Blustone','blustone br':'Blustone','boost vc':'Boost','cube ventures':'Cube VC',
  'dalus':'Dalus VC','first check vc':'First Check Ventures','honey island':'Honey Island VC','invariantes fund':'Invariantes',
  'maya capital':'Maya Ventures','norte ventures':'Norte','norte br':'Norte','onevc':'One VC','pygma':'Pygma VC','upload ventures':'Upload',
  '500 latam seed -iv':'500 Latam Seed IV','alpes lab':'Alpes Lab','alpes labs':'Alpes Lab',
  'gilgames vc':'Gilgamesh Ventures','gilgamesh vc':'Gilgamesh Ventures','gilgamesh am':'Gilgamesh Ventures','gilgamesh summit':'Gilgamesh Ventures',
  'selvaviva':'Selva Viva','vitaldoc':'Vital-Doc','atomic kitch':'Atomic Kitchens','line up':'LineUp','procitex-ecofiber':'Procitex','carlos vial (berkeley vc)':'Carlos Vial',
}
const applyCanonical = n => CANONICAL_NAMES[nn(n)] ?? n
const MEETING_LINK = {
  'cencosud ventures':'Cencosud CVC','guil vc':'Guil Mobility','genesis ventures':'Genesis VC','wayra meet & drink':'Wayra Hispam',
  'lv vc':'LarrainVial','fintech collective':'Fintech.io','fintech co':'Fintech.io','ny - fintech co':'Fintech.io',
  'valor':'Valor Capital Partners','ny - valor capital group':'Valor Capital Partners','ny - portage':'Portage ventures',
  '500':'500','500 latam':'500','luchadores iii':'Luchadores III','amador ventures':'Amador Ventures','amador holdings':'Amador Ventures',
  'fen ventures':'FEN Ventures','endeavor':'Endeavor','endeavor catalyst':'Endeavor Catalyst',
  'mrpink':'Mr Pink','salkantay':'Salkantay VC','ny - red bike':'Red Bike',
}
const CREATE = ['500','Luchadores III','Amador Ventures','FEN Ventures','Endeavor','Endeavor Catalyst',
  'a16z Brazil','ABSeed','Alexia VC','Caravela','Cortado Ventures','Mr Pink','Red Bike','Salkantay VC','Squad Ventures','SaaSholic','The Venture City','Bridge Latam','DKF']

function extractKey(raw){
  let t=raw.trim()
  if(t.includes('<>'))t=t.split('<>')[0].trim()
  if(/^reunión /i.test(t))t=t.replace(/^reunión /i,'').trim()
  t=t.replace(/[\s-]+\d{6,9}\s*$/,'').trim().replace(/\s*-\s*$/,'').trim()
  t=t.replace(/\s*-\s*[\u{1F1E0}-\u{1F1FF}\u{1F3F4}]+$/u,'').trim()
  if(/^update /i.test(t))t=t.replace(/^update /i,'').trim()
  return nn(applyCanonical(t))
}

const crm=pc(readFileSync(join(BBDD,'CRM 4323ea4bb2a94ff59bc9091b20650432.csv'),'utf8'))
const con=pc(readFileSync(join(BBDD,'Contacts f88a598ba9fb4c81be0cc0052aad32fe.csv'),'utf8'))
const mtg=pc(readFileSync(join(BBDD,'Meetings dd43ebe1c83647aea8aa62b6d5ef1be0.csv'),'utf8'))

const companyKeys=new Map()
for(const r of crm){if(r['Name']){const n=applyCanonical(r['Name']);companyKeys.set(nn(n),n)}}
for(const r of con){if(r['Name']){const n=applyCanonical(r['Name']);if(!companyKeys.has(nn(n)))companyKeys.set(nn(n),n)}}
for(const n of CREATE)if(!companyKeys.has(nn(n)))companyKeys.set(nn(n),n)

console.log(`Companies expected: ${companyKeys.size}  (CRM+Contacts unique + ${CREATE.length} explicit creates)`)

function resolve(title){let k=extractKey(title);if(MEETING_LINK[k])k=nn(MEETING_LINK[k]);return companyKeys.has(k)?companyKeys.get(k):null}
let matched=0;const unmatched=[]
for(const r of mtg){const t=r['Name']?.trim();if(!t)continue;const c=resolve(t);if(c)matched++;else unmatched.push(t)}
console.log(`Meetings: ${matched} linked, ${unmatched.length} null  (was 126 / 112)\n`)

// stray-company check: every meeting key must map to a known company OR be left null —
// it must NEVER invent a company. (companyKeys built only from CRM+Contacts+CREATE.)
console.log('── Remaining null-company meetings (expected: Section C standalone) ──')
for(const t of unmatched)console.log(`  ${t}`)

// sanity: confirm the create-list + reparent targets exist
console.log('\n── Hierarchy sanity ──')
for(const n of ['500','500 Latam Seed IV','SEA 500','Luchadores III','Endeavor','Endeavor Catalyst','Gilgamesh Ventures','Fintech.io'])
  console.log(`  ${companyKeys.has(nn(n))?'✓':'✗'} ${n}`)
