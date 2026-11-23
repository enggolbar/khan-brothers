import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, Plus, Search, Users, X } from 'lucide-react';

export interface AdminCustomer {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  customer_type: 'lead' | 'prospect' | 'customer' | 'inactive';
  source: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

type CustomerForm = Omit<AdminCustomer, 'id' | 'created_at' | 'updated_at'>;
const emptyForm: CustomerForm = { company_name: '', contact_name: '', phone: '', email: '', address: '', district: '', customer_type: 'lead', source: '', notes: '' };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body as T;
}

export const AdminCrmPanel: React.FC = () => {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try { setCustomers(await api<AdminCustomer[]>('/api/admin/crm/customers')); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load CRM contacts.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => customers.filter((customer) => `${customer.company_name} ${customer.contact_name} ${customer.phone} ${customer.email}`.toLowerCase().includes(search.toLowerCase())), [customers, search]);

  const startCreate = () => { setEditingId(null); setForm(emptyForm); setNotice(''); setShowForm(true); };
  const startEdit = (customer: AdminCustomer) => {
    const { id, created_at, updated_at, ...values } = customer;
    setEditingId(id); setForm(values); setNotice(''); setShowForm(true);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      await api(editingId ? `/api/admin/crm/customers/${editingId}` : '/api/admin/crm/customers', {
        method: editingId ? 'PUT' : 'POST', body: JSON.stringify(form),
      });
      setShowForm(false); setEditingId(null); setForm(emptyForm);
      setNotice(editingId ? 'CRM contact updated.' : 'CRM contact added.');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the contact.'); }
    finally { setSaving(false); }
  };

  const field = (key: keyof CustomerForm, label: string, required = false, type = 'text') => (
    <label className="block" key={key}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}{required ? ' *' : ''}</span>
      <input type={type} required={required} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10" />
    </label>
  );

  return <section className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><h2 className="text-lg font-bold">Customer Relationship Management</h2><p className="mt-1 text-sm text-slate-500">Manage AnZ-Soft leads, customers, contacts, notes, and follow-up status.</p></div>
      <button type="button" onClick={startCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-900"><Plus className="h-4 w-4" /> Add customer</button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

    {showForm && <form onSubmit={(event) => void submit(event)} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold">{editingId ? 'Edit CRM contact' : 'Add CRM contact'}</h3><p className="mt-1 text-xs text-slate-500">Company and contact details used for invoices, quotations, and receipts.</p></div><button type="button" aria-label="Close form" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {field('company_name', 'Company / shop name', true)}{field('contact_name', 'Contact person')}{field('phone', 'Phone', false, 'tel')}{field('email', 'Email', false, 'email')}{field('address', 'Address')}{field('district', 'District')}
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Relationship stage</span><select value={form.customer_type} onChange={(event) => setForm((current) => ({ ...current, customer_type: event.target.value as CustomerForm['customer_type'] }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="lead">Lead</option><option value="prospect">Prospect</option><option value="customer">Customer</option><option value="inactive">Inactive</option></select></label>
        {field('source', 'Lead source')}
        <label className="block sm:col-span-2 lg:col-span-3"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Notes and follow-up details</span><textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-600" /></label>
      </div>
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add customer'}</button></div>
    </form>}

    <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><div><h3 className="font-bold">CRM contacts <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-800">{customers.length}</span></h3><p className="mt-1 text-xs text-slate-500">Search, review, and update customer records.</p></div><div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone, or email" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-600" /></div></div>
      {loading ? <p className="p-10 text-center text-sm text-slate-500">Loading CRM contacts…</p> : filtered.length === 0 ? <div className="p-12 text-center"><Users className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No CRM contacts found</p><p className="mt-1 text-xs text-slate-500">Add a customer or adjust your search.</p></div> : <div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Company / contact</th><th className="px-4 py-3">Contact details</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Stage / source</th><th className="px-4 py-3">Notes</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((customer) => <tr key={customer.id} className="align-top"><td className="px-4 py-4"><p className="font-bold text-slate-900">{customer.company_name || '—'}</p><p className="mt-1 text-slate-500">{customer.contact_name}</p></td><td className="px-4 py-4 leading-5 text-slate-600">{customer.phone || '—'}<br />{customer.email || '—'}</td><td className="px-4 py-4 leading-5 text-slate-600">{customer.address || '—'}<br />{customer.district}</td><td className="px-4 py-4"><span className="rounded-full bg-blue-50 px-2 py-1 font-semibold capitalize text-blue-800">{customer.customer_type}</span><p className="mt-2 text-slate-500">{customer.source || 'No source'}</p></td><td className="max-w-[220px] px-4 py-4 text-slate-600"><span className="line-clamp-3">{customer.notes || '—'}</span></td><td className="px-4 py-4 text-right"><button type="button" onClick={() => startEdit(customer)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"><Edit3 className="h-3.5 w-3.5" /> Edit</button></td></tr>)}</tbody></table></div>}
    </div>
  </section>;
};
