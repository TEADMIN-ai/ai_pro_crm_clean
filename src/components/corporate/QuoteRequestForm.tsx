'use client';

import { useState, type FormEvent } from 'react';
import { getCorporateEmail } from '@/lib/corporate/companyProfile';

export type QuoteRequestFields = { fullName: string; companyName: string; email: string; phone: string; service: string; location: string; scope: string; preferredDate: string; message: string; consent: boolean; };
export type QuoteErrors = Partial<Record<keyof QuoteRequestFields, string>>;

const limits: Record<Exclude<keyof QuoteRequestFields, 'consent'>, number> = { fullName: 100, companyName: 120, email: 160, phone: 40, service: 80, location: 160, scope: 220, preferredDate: 40, message: 1200 };
const required: Array<keyof QuoteRequestFields> = ['fullName', 'email', 'phone', 'service', 'location', 'message', 'consent'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const blankQuoteRequest: QuoteRequestFields = { fullName: '', companyName: '', email: '', phone: '', service: '', location: '', scope: '', preferredDate: '', message: '', consent: false };

export function normalizeQuoteValue(value: string): string {
  return value.replace(/[<>]/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function validateQuoteRequest(input: QuoteRequestFields): QuoteErrors {
  const errors: QuoteErrors = {};
  for (const field of required) {
    const value = input[field];
    if (field === 'consent') { if (!value) errors.consent = 'Confirm consent before creating the email request.'; continue; }
    if (!normalizeQuoteValue(String(value ?? ''))) errors[field] = 'This field is required.';
  }
  for (const [field, max] of Object.entries(limits) as Array<[Exclude<keyof QuoteRequestFields, 'consent'>, number]>) {
    if (normalizeQuoteValue(input[field]).length > max) errors[field] = 'Keep this field under ' + max + ' characters.';
  }
  if (input.email && !emailPattern.test(normalizeQuoteValue(input.email))) errors.email = 'Enter a valid email address.';
  return errors;
}

export function hasQuoteErrors(errors: QuoteErrors): boolean { return Object.keys(errors).length > 0; }

export function buildQuoteMailto(input: QuoteRequestFields, to = getCorporateEmail('info')): string {
  const safe = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? normalizeQuoteValue(value) : value])) as QuoteRequestFields;
  const subject = 'Quote request - ' + safe.service;
  const body = [
    'Torque Empire quote request',
    '',
    'Full name: ' + safe.fullName,
    'Company: ' + (safe.companyName || 'Not provided'),
    'Email: ' + safe.email,
    'Phone: ' + safe.phone,
    'Service required: ' + safe.service,
    'Site or project location: ' + safe.location,
    'Estimated quantity or scope: ' + (safe.scope || 'Not provided'),
    'Preferred service date: ' + (safe.preferredDate || 'Not provided'),
    '',
    'Message:',
    safe.message,
    '',
    'Consent confirmed: Yes. The requester consents to Torque Empire using this information to respond to the enquiry.',
  ].join('\n');
  return 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}

function fieldId(name: keyof QuoteRequestFields) { return 'quote-' + name; }

export default function QuoteRequestForm() {
  const [values, setValues] = useState<QuoteRequestFields>(blankQuoteRequest);
  const [errors, setErrors] = useState<QuoteErrors>({});
  const [mailto, setMailto] = useState<string | null>(null);

  function update(name: keyof QuoteRequestFields, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
    setMailto(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateQuoteRequest(values);
    setErrors(nextErrors);
    if (hasQuoteErrors(nextErrors)) { setMailto(null); return; }
    const href = buildQuoteMailto(values);
    setMailto(href);
    window.location.href = href;
  }

  const services = ['Procurement and tender support', 'Hygiene and sanitary waste management', 'Telecommunications services', 'Automotive and car sales', 'TEOS business technology', 'General corporate enquiry'];

  return (
    <form onSubmit={submit} className='grid gap-5 rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-6' noValidate>
      <p className='text-sm font-medium leading-6 text-slate-600'>Complete the form below and your enquiry will be prepared for email submission to Torque Empire.</p>
      <div className='grid gap-4 md:grid-cols-2'>
        <TextField name='fullName' label='Full name' value={values.fullName} error={errors.fullName} onChange={update} required />
        <TextField name='companyName' label='Company name' value={values.companyName} error={errors.companyName} onChange={update} />
        <TextField name='email' label='Email' type='email' value={values.email} error={errors.email} onChange={update} required />
        <TextField name='phone' label='Phone' value={values.phone} error={errors.phone} onChange={update} required />
        <label className='grid gap-2 text-sm font-semibold text-slate-800' htmlFor={fieldId('service')}>Service required<span className='sr-only'> required</span><select id={fieldId('service')} value={values.service} onChange={(event) => update('service', event.target.value)} aria-invalid={Boolean(errors.service)} aria-describedby={errors.service ? fieldId('service') + '-error' : undefined} className='min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-[#0b2f57] focus:outline-none focus:ring-2 focus:ring-[#0b2f57]/25'><option value=''>Select a service</option>{services.map((service) => <option key={service} value={service}>{service}</option>)}</select>{errors.service ? <span id={fieldId('service') + '-error'} className='text-xs font-bold text-red-700'>{errors.service}</span> : null}</label>
        <TextField name='location' label='Site or project location' value={values.location} error={errors.location} onChange={update} required />
        <TextField name='scope' label='Estimated quantity or scope' value={values.scope} error={errors.scope} onChange={update} />
        <TextField name='preferredDate' label='Preferred service date' value={values.preferredDate} error={errors.preferredDate} onChange={update} />
      </div>
      <label className='grid gap-2 text-sm font-semibold text-slate-800' htmlFor={fieldId('message')}>Message<span className='sr-only'> required</span><textarea id={fieldId('message')} value={values.message} maxLength={limits.message} onChange={(event) => update('message', event.target.value)} rows={6} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? fieldId('message') + '-error' : undefined} className='rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#0b2f57] focus:outline-none focus:ring-2 focus:ring-[#0b2f57]/25' />{errors.message ? <span id={fieldId('message') + '-error'} className='text-xs font-bold text-red-700'>{errors.message}</span> : null}</label>
      <label className='flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-medium leading-6 text-slate-700'><input type='checkbox' checked={values.consent} onChange={(event) => update('consent', event.target.checked)} aria-invalid={Boolean(errors.consent)} className='mt-1 h-4 w-4 rounded border-slate-300' /><span>I consent to Torque Empire using the information in my email request to respond to this enquiry.</span></label>
      {errors.consent ? <p className='text-sm font-bold text-red-700'>{errors.consent}</p> : null}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'><button type='submit' className='min-h-11 rounded-md bg-[#0b2f57] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#07111f] focus:outline-none focus:ring-2 focus:ring-[#0b2f57]/30'>Create Email Request</button>{mailto ? <a href={mailto} className='text-sm font-bold text-[#0b2f57] underline underline-offset-4'>Open prepared email again</a> : null}</div>
    </form>
  );
}

function TextField({ name, label, value, error, onChange, type = 'text', required = false }: { name: Exclude<keyof QuoteRequestFields, 'consent' | 'service' | 'message'>; label: string; value: string; error?: string; onChange: (name: keyof QuoteRequestFields, value: string) => void; type?: string; required?: boolean }) {
  const id = fieldId(name);
  return <label className='grid gap-2 text-sm font-semibold text-slate-800' htmlFor={id}>{label}{required ? <span className='sr-only'> required</span> : null}<input id={id} type={type} value={value} maxLength={limits[name]} onChange={(event) => onChange(name, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined} className='min-h-11 rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#0b2f57] focus:outline-none focus:ring-2 focus:ring-[#0b2f57]/25' />{error ? <span id={id + '-error'} className='text-xs font-bold text-red-700'>{error}</span> : null}</label>;
}
