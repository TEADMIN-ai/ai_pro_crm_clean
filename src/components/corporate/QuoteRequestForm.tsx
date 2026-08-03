'use client';

import { useRef, useState, type FormEvent } from 'react';
import { getCorporateEmail } from '@/lib/corporate/companyProfile';

export type QuoteRequestFields = { fullName: string; companyName: string; email: string; phone: string; service: string; location: string; scope: string; preferredDate: string; message: string; consent: boolean; };
export type QuoteErrors = Partial<Record<keyof QuoteRequestFields, string>>;
export type QuoteStatus = 'idle' | 'validation_error' | 'request_prepared' | 'copy_success' | 'copy_failed';

const limits: Record<Exclude<keyof QuoteRequestFields, 'consent'>, number> = { fullName: 100, companyName: 120, email: 160, phone: 40, service: 80, location: 160, scope: 220, preferredDate: 40, message: 1200 };
const required: Array<keyof QuoteRequestFields> = ['fullName', 'email', 'phone', 'service', 'location', 'message', 'consent'];
const validationOrder: Array<keyof QuoteRequestFields> = ['fullName', 'email', 'phone', 'service', 'location', 'message', 'consent', 'companyName', 'scope', 'preferredDate'];
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
export function getFirstQuoteErrorField(errors: QuoteErrors): keyof QuoteRequestFields | null { return validationOrder.find((field) => Boolean(errors[field])) ?? null; }

export function buildQuoteEmailBody(input: QuoteRequestFields): string {
  const safe = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? normalizeQuoteValue(value) : value])) as QuoteRequestFields;
  return [
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
}

export function buildQuoteClipboardText(input: QuoteRequestFields, to = getCorporateEmail('info')): string {
  return ['To: ' + to, 'Subject: Quote request - ' + normalizeQuoteValue(input.service), '', buildQuoteEmailBody(input)].join('\n');
}

export function buildQuoteMailto(input: QuoteRequestFields, to = getCorporateEmail('info')): string {
  const subject = 'Quote request - ' + normalizeQuoteValue(input.service);
  const body = buildQuoteEmailBody(input);
  return 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}

function fieldId(name: keyof QuoteRequestFields) { return 'quote-' + name; }

export default function QuoteRequestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<QuoteRequestFields>(blankQuoteRequest);
  const [errors, setErrors] = useState<QuoteErrors>({});
  const [mailto, setMailto] = useState<string | null>(null);
  const [preparedText, setPreparedText] = useState<string | null>(null);
  const [status, setStatus] = useState<QuoteStatus>('idle');
  const [isOpeningEmail, setIsOpeningEmail] = useState(false);

  function update(name: keyof QuoteRequestFields, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
    setStatus('idle');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isOpeningEmail) return;
    const nextErrors = validateQuoteRequest(values);
    setErrors(nextErrors);
    if (hasQuoteErrors(nextErrors)) {
      setMailto(null);
      setPreparedText(null);
      setStatus('validation_error');
      const firstErrorField = getFirstQuoteErrorField(nextErrors);
      window.requestAnimationFrame(() => {
        if (!firstErrorField) return;
        formRef.current?.querySelector<HTMLElement>('#' + fieldId(firstErrorField))?.focus();
      });
      return;
    }
    const href = buildQuoteMailto(values);
    if (!href.startsWith('mailto:')) {
      setStatus('validation_error');
      return;
    }
    setMailto(href);
    setPreparedText(buildQuoteClipboardText(values));
    setStatus('request_prepared');
    setIsOpeningEmail(true);
    window.location.href = href;
    window.setTimeout(() => setIsOpeningEmail(false), 1200);
  }

  async function copyPreparedRequest() {
    if (!preparedText) {
      setStatus('copy_failed');
      return;
    }

    try {
      await navigator.clipboard.writeText(preparedText);
      setStatus('copy_success');
    } catch {
      setStatus('copy_failed');
    }
  }

  const services = ['Procurement and tender support', 'Hygiene and sanitary waste management', 'Telecommunications services', 'Automotive and car sales', 'TEOS business technology', 'General corporate enquiry'];

  return (
    <form ref={formRef} onSubmit={submit} className='grid gap-5 rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-6' noValidate>
      <p className='text-sm font-medium leading-6 text-slate-600'>Complete the form below and your enquiry will be prepared for email submission to Torque Empire.</p>
      <QuoteStatusPanel status={status} mailto={mailto} preparedText={preparedText} onCopy={copyPreparedRequest} />
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
      <label className='flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-medium leading-6 text-slate-700'><input id={fieldId('consent')} type='checkbox' checked={values.consent} onChange={(event) => update('consent', event.target.checked)} aria-invalid={Boolean(errors.consent)} className='mt-1 h-4 w-4 rounded border-slate-300' /><span>I consent to Torque Empire using the information in my email request to respond to this enquiry.</span></label>
      {errors.consent ? <p id={fieldId('consent') + '-error'} className='text-sm font-bold text-red-700'>{errors.consent}</p> : null}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'><button type='submit' disabled={isOpeningEmail} className='min-h-11 rounded-md bg-[#0b2f57] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#07111f] focus:outline-none focus:ring-2 focus:ring-[#0b2f57]/30 disabled:cursor-wait disabled:bg-slate-500'>{isOpeningEmail ? 'Opening Email Application...' : 'Create Email Request'}</button>{mailto ? <a href={mailto} className='text-sm font-bold text-[#0b2f57] underline underline-offset-4' onClick={() => setStatus('request_prepared')}>Open email application again</a> : null}</div>
    </form>
  );
}


function QuoteStatusPanel({ status, mailto, preparedText, onCopy }: { status: QuoteStatus; mailto: string | null; preparedText: string | null; onCopy: () => void }) {
  const quoteEmail = getCorporateEmail('info');
  if (status === 'idle') return null;

  if (status === 'validation_error') {
    return <div role='alert' className='rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800'>Please correct the highlighted fields before creating the email request.</div>;
  }

  return (
    <div role={status === 'copy_failed' ? 'alert' : 'status'} aria-live='polite' className='rounded-md border border-[#0b2f57]/20 bg-blue-50 p-4 text-sm leading-6 text-slate-700'>
      <h3 className='text-base font-extrabold text-[#07111f]'>Your quote request has been prepared.</h3>
      <p className='mt-2'>Your email application should open so you can review and send it.</p>
      <p className='mt-2 font-bold text-[#07111f]'>The request has not been sent automatically.</p>
      <div className='mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-3'>
        <p className='font-semibold'>If your email application does not open, send the request to <a className='text-[#0b2f57] underline underline-offset-4' href={'mailto:' + quoteEmail}>{quoteEmail}</a>.</p>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
          <button type='button' onClick={onCopy} disabled={!preparedText} className='min-h-11 rounded-md border border-[#0b2f57] px-4 py-2 text-sm font-bold text-[#0b2f57] transition hover:bg-[#0b2f57] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#0b2f57]/25 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400'>Copy prepared request details</button>
          {mailto ? <a href={mailto} className='text-sm font-bold text-[#0b2f57] underline underline-offset-4'>Open email application again</a> : null}
        </div>
        {status === 'copy_success' ? <p className='font-bold text-green-700'>Prepared request details copied.</p> : null}
        {status === 'copy_failed' ? <p className='font-bold text-red-700'>The request details could not be copied. Please select and copy the form details manually.</p> : null}
      </div>
    </div>
  );
}

function TextField({ name, label, value, error, onChange, type = 'text', required = false }: { name: Exclude<keyof QuoteRequestFields, 'consent' | 'service' | 'message'>; label: string; value: string; error?: string; onChange: (name: keyof QuoteRequestFields, value: string) => void; type?: string; required?: boolean }) {
  const id = fieldId(name);
  return <label className='grid gap-2 text-sm font-semibold text-slate-800' htmlFor={id}>{label}{required ? <span className='sr-only'> required</span> : null}<input id={id} type={type} value={value} maxLength={limits[name]} onChange={(event) => onChange(name, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined} className='min-h-11 rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#0b2f57] focus:outline-none focus:ring-2 focus:ring-[#0b2f57]/25' />{error ? <span id={id + '-error'} className='text-xs font-bold text-red-700'>{error}</span> : null}</label>;
}
