export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'super_admin' | 'sr';
  businessName?: string;
  isDemo?: boolean;
  localDemo?: boolean;
  shopId?: string;
  staffId?: string;
  staffPhone?: string;
  routeArea?: string;
  branchName?: string;
}

const localDemoKey='kbshop.local-demo-session.v1';
const localDemoUser:AppUser={uid:'local-demo-owner',email:'demo@kbshop.example',displayName:'Demo Owner',role:'owner',businessName:'Demo Super Shop',isDemo:true,localDemo:true};
let memoryDemoSession=false;

export function isLocalDemoSession():boolean {
  try { return memoryDemoSession || localStorage.getItem(localDemoKey)==='active'; } catch { return memoryDemoSession; }
}

export interface SignupFormData {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  businessType: string;
  address: string;
  district: string;
  password: string;
}

async function authRequest<T>(path: string, body?: unknown, method = body ? 'POST' : 'GET'): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Authentication request failed.') as Error & { code?: string; status?: number };
    error.code = result.code;
    error.status = response.status;
    throw error;
  }
  return result as T;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if(isLocalDemoSession()) return localDemoUser;
  try {
    const result = await authRequest<{ user: AppUser | null }>('/me');
    return result.user;
  } catch (error) {
    if ((error as { status?: number }).status === 401) return null;
    console.info('Server session is unavailable; showing the sign-in panel.');
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  if(email.trim().toLowerCase()==='demo@kbshop.example' && password==='Demo@12345') {
    memoryDemoSession=true;
    try { localStorage.setItem(localDemoKey,'active'); } catch { /* Keep this tab's demo session in memory. */ }
    return localDemoUser;
  }
  const result = await authRequest<{ user: AppUser }>('/login', { email, password });
  return result.user;
}

export async function signInWithSrPin(businessPhone: string, staffPhone: string, pin: string): Promise<AppUser> {
  const result = await authRequest<{user:AppUser}>('/sr-pin', {businessPhone,staffPhone,pin});
  return result.user;
}

export async function requestSignup(details: SignupFormData): Promise<void> {
  await authRequest('/signup', details);
}

export async function signOut(): Promise<void> {
  if(isLocalDemoSession()) {
    memoryDemoSession=false;
    try { localStorage.removeItem(localDemoKey); } catch { /* Ignore storage cleanup failure. */ }
    return;
  }
  await authRequest('/logout', {}, 'POST');
}
