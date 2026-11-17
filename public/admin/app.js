import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

const app = document.querySelector('#app');
const dialog = document.querySelector('#editor-dialog');
const toastRegion = document.querySelector('#toast-region');
const moduleState = new Map();
let supabase;
let currentUser;
let activeSection = 'overview';
let cachedCategories = [];
let cachedProducts = [];
let renderToken = 0;

const navGroups = [
  { label: 'Workspace', items: [{ id: 'overview', label: 'Overview', icon: 'grid' }] },
  { label: 'Product catalog', items: [
    { id: 'categories', label: 'Product categories', icon: 'layers' },
    { id: 'products', label: 'Products', icon: 'box' },
    { id: 'models', label: '3D preview assets', icon: 'cube' },
  ] },
  { label: 'Site content', items: [
    { id: 'pages', label: 'Pages', icon: 'file' },
    { id: 'articles', label: 'Articles', icon: 'book' },
    { id: 'media', label: 'Media library', icon: 'image' },
    { id: 'settings', label: 'Site settings', icon: 'sliders' },
  ] },
  { label: 'Customer requests', items: [
    { id: 'appointments', label: 'Appointments', icon: 'calendar' },
    { id: 'booking-settings', label: 'Booking schedule', icon: 'clock' },
    { id: 'inquiries', label: 'Quote inquiries', icon: 'mail' },
  ] },
];

const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  box: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
  cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.3 7.7 7.7 4.4 7.7-4.4M12 12.1V21"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  logout: '<path d="M10 17l5-5-5-5M15 12H3M21 3v18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  external: '<path d="M14 3h7v7M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
};

const definitions = {
  categories: {
    table: 'product_categories', title: 'Product categories',
    description: 'Manage the grouped categories shown in the Products menu and product pages.',
    singular: 'category', add: 'Add category',
    columns: ['name', 'group', 'slug', 'menu', 'order'],
    fields: [
      { name: 'name', label: 'Category name', required: true },
      { name: 'slug', label: 'URL slug', required: true },
      { name: 'menu_group', label: 'Menu group', type: 'select', options: [['pouch-formats', 'Pouch Formats'], ['specialty-packaging', 'Specialty Packaging']] },
      { name: 'menu_order', label: 'Menu order', type: 'number', value: 10 },
      { name: 'short_description', label: 'Short description', type: 'textarea', full: true },
      { name: 'image_url', label: 'Menu image URL', type: 'text', full: true, help: 'Use a current media URL or upload an image below.' },
      { name: '_upload', label: 'Upload menu image', type: 'file', full: true, accept: 'image/png,image/jpeg,image/webp,image/avif', target: 'image_url', folder: 'category-images' },
      { name: 'show_in_menu', label: 'Show in Products menu', type: 'checkbox', value: true },
      { name: 'status', label: 'Status', type: 'select', options: [['published', 'Published'], ['draft', 'Draft'], ['archived', 'Archived']] },
      { name: 'seo_title', label: 'SEO title', full: true },
      { name: 'seo_description', label: 'SEO description', type: 'textarea', full: true },
    ],
  },
  products: {
    table: 'products', title: 'Products', description: 'Manage showcase items and their packaging specifications.', singular: 'product', add: 'Add product',
    columns: ['name', 'category', 'slug', 'status'],
    fields: [
      { name: 'name', label: 'Product name', required: true },
      { name: 'slug', label: 'URL slug', required: true },
      { name: 'category_id', label: 'Product category', type: 'category', full: true },
      { name: 'short_description', label: 'Short description', type: 'textarea', full: true },
      { name: 'description', label: 'Product description', type: 'textarea', full: true },
      { name: 'primary_image_url', label: 'Main image URL', type: 'text', full: true },
      { name: '_upload', label: 'Upload main image', type: 'file', full: true, accept: 'image/png,image/jpeg,image/webp,image/avif', target: 'primary_image_url', folder: 'product-images' },
      { name: 'features', label: 'Packaging features', type: 'array', full: true, help: 'One item per line.' },
      { name: 'material_options', label: 'Material options', type: 'array', full: true, help: 'One item per line.' },
      { name: 'printing_options', label: 'Printing and finishing', type: 'array', full: true, help: 'One item per line.' },
      { name: 'applications', label: 'Suitable applications', type: 'array', full: true, help: 'One item per line.' },
      { name: 'is_featured', label: 'Feature this product', type: 'checkbox' },
      { name: 'sort_order', label: 'Display order', type: 'number', value: 0 },
      { name: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['published', 'Published'], ['archived', 'Archived']] },
      { name: 'seo_title', label: 'SEO title', full: true },
      { name: 'seo_description', label: 'SEO description', type: 'textarea', full: true },
    ],
  },
  pages: {
    table: 'pages', title: 'Pages', description: 'Manage page records and structured sections while keeping the current page templates intact.', singular: 'page', add: 'Add page',
    columns: ['title', 'slug', 'template_key', 'status'],
    fields: [
      { name: 'title', label: 'Page title', required: true },
      { name: 'slug', label: 'URL slug', required: true },
      { name: 'template_key', label: 'Page template', value: 'page-default' },
      { name: 'summary', label: 'Short summary', type: 'textarea', full: true },
      { name: 'sections', label: 'Page sections (JSON)', type: 'json', full: true, help: 'Structured section data for the matching frontend template.' },
      { name: 'sort_order', label: 'Menu order', type: 'number', value: 0 },
      { name: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['published', 'Published'], ['archived', 'Archived']] },
      { name: 'seo_title', label: 'SEO title', full: true },
      { name: 'seo_description', label: 'SEO description', type: 'textarea', full: true },
    ],
  },
  articles: {
    table: 'articles', title: 'Articles', description: 'Manage packaging guides, news, and search metadata.', singular: 'article', add: 'Add article',
    columns: ['title', 'slug', 'published_at', 'status'],
    fields: [
      { name: 'title', label: 'Article title', required: true },
      { name: 'slug', label: 'URL slug', required: true },
      { name: 'excerpt', label: 'Excerpt', type: 'textarea', full: true },
      { name: 'body', label: 'Article body (HTML)', type: 'textarea', full: true },
      { name: 'featured_image_url', label: 'Featured image URL', type: 'text', full: true },
      { name: '_upload', label: 'Upload featured image', type: 'file', full: true, accept: 'image/png,image/jpeg,image/webp,image/avif', target: 'featured_image_url', folder: 'article-images' },
      { name: 'published_at', label: 'Publish date', type: 'datetime-local' },
      { name: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['published', 'Published'], ['archived', 'Archived']] },
      { name: 'seo_title', label: 'SEO title', full: true },
      { name: 'seo_description', label: 'SEO description', type: 'textarea', full: true },
    ],
  },
  models: {
    table: 'model_assets', title: '3D preview assets', description: 'Upload GLB models and assign them to showcase products.', singular: '3D asset', add: 'Add 3D asset',
    columns: ['name', 'product', 'status'],
    fields: [
      { name: 'name', label: 'Asset name', required: true },
      { name: 'model_url', label: 'GLB model URL', type: 'text', full: true },
      { name: '_upload', label: 'Upload GLB / GLTF model', type: 'file', full: true, accept: '.glb,.gltf,model/gltf-binary,model/gltf+json,application/octet-stream', target: 'model_url', folder: '3d-models' },
      { name: 'poster_url', label: 'Preview image URL', type: 'text', full: true },
      { name: '_poster_upload', label: 'Upload preview image', type: 'file', full: true, accept: 'image/png,image/jpeg,image/webp,image/avif', target: 'poster_url', folder: '3d-posters' },
      { name: 'product_id', label: 'Linked product', type: 'product', full: true },
      { name: 'preview_settings', label: 'Viewer settings (JSON)', type: 'json', full: true },
      { name: 'sort_order', label: 'Display order', type: 'number', value: 0 },
      { name: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['published', 'Published'], ['archived', 'Archived']] },
    ],
  },
  media: {
    table: 'media_assets', title: 'Media library', description: 'Store product photos, logos, posters, and 3D preview files.', singular: 'media item', add: 'Upload media',
    columns: ['file_name', 'mime_type', 'public_url', 'created_at'],
    fields: [
      { name: 'file_name', label: 'File name', required: true },
      { name: '_upload', label: 'Choose file', type: 'file', full: true, accept: 'image/*,.glb,.gltf', target: 'public_url', folder: 'uploads' },
      { name: 'alt_text', label: 'Alternative text', type: 'textarea', full: true },
      { name: 'public_url', label: 'File URL', type: 'text', full: true },
      { name: 'mime_type', label: 'MIME type' },
    ],
  },
  settings: {
    table: 'site_settings', title: 'Site settings', description: 'Edit shared public details and frontend configuration values.', singular: 'setting', add: 'Add setting',
    columns: ['key', 'value', 'is_public'],
    fields: [
      { name: 'key', label: 'Setting key', required: true },
      { name: 'value', label: 'Value (JSON)', type: 'json', full: true },
      { name: 'is_public', label: 'Expose to public frontend', type: 'checkbox' },
    ],
  },
  inquiries: {
    table: 'inquiries', title: 'Quote inquiries', description: 'Review customer requests and track follow-up status.', singular: 'inquiry', add: null,
    columns: ['contact_name', 'company', 'email', 'status', 'created_at'], fields: [],
  },
};

function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? esc(value) : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function showToast(message, error = false) {
  const toast = document.createElement('div');
  toast.className = `toast${error ? ' error' : ''}`;
  toast.textContent = message;
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function setupView() {
  app.innerHTML = `<div class="signin-wrap"><section class="setup-card">
    <div class="signin-brand"><span class="brand-mark">M</span><div><div class="brand-name">Mewepak Studio</div><div class="brand-caption">CMS setup</div></div></div>
    <h1>Connect the admin to Supabase</h1>
    <p>The repository is ready for the standalone admin. Add the runtime settings in Cloudflare Pages, then run the database setup script.</p>
    <ol><li>Set <code>SUPABASE_URL</code> and <code>SUPABASE_PUBLISHABLE_KEY</code> for Pages Functions.</li><li>Set the server-only <code>SUPABASE_SERVICE_ROLE_KEY</code> and <code>TURNSTILE_SECRET_KEY</code>.</li><li>Run <code>database/schema.sql</code> once in the Supabase SQL Editor and add the admin role to the first approved user’s <code>app_metadata</code>.</li></ol>
    <p>The service role key is only read by server functions. It is never returned to this page.</p>
  </section></div>`;
}

function loginView(error = '') {
  app.innerHTML = `<div class="signin-wrap"><section class="signin-card">
    <div class="signin-brand"><span class="brand-mark">M</span><div><div class="brand-name">Mewepak Studio</div><div class="brand-caption">Site management</div></div></div>
    <h1>Welcome back</h1><p>Sign in with an approved Mewepak staff account.</p>
    ${error ? `<div class="error-box" role="alert">${esc(error)}</div>` : ''}
    <form class="signin-form" id="login-form">
      <div class="field"><label for="login-email">Email address</label><input class="control" id="login-email" name="email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="login-password">Password</label><input class="control" id="login-password" name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn btn-primary" type="submit">Sign in ${icon('arrow')}</button>
    </form>
  </section></div>`;
  document.querySelector('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    button.textContent = 'Signing in…';
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: form.get('email'), password: form.get('password') });
    if (signInError) return loginView('Sign-in failed. Check the email and password, then try again.');
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !isStaff(data.user)) {
      await supabase.auth.signOut();
      return loginView('This account does not have Mewepak staff access.');
    }
    currentUser = data.user;
    activeSection = 'overview';
    await renderApp();
  });
}

function isStaff(user) {
  const role = user?.app_metadata?.role;
  return role === 'admin' || role === 'editor';
}

function pageTitle(id) {
  for (const group of navGroups) {
    const found = group.items.find((item) => item.id === id);
    if (found) return found.label;
  }
  return 'Mewepak Studio';
}

function shellMarkup(content) {
  const email = currentUser?.email || 'Staff account';
  const initial = email.trim().charAt(0).toUpperCase() || 'M';
  return `<div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><span class="brand-mark">M</span><div><div class="brand-name">Mewepak Studio</div><div class="brand-caption">Content workspace</div></div></div>
      ${navGroups.map((group) => `<div class="nav-label">${esc(group.label)}</div><nav class="nav-list">${group.items.map((item) => `<button class="nav-item${activeSection === item.id ? ' active' : ''}" type="button" data-section="${esc(item.id)}">${icon(item.icon)}<span>${esc(item.label)}</span></button>`).join('')}</nav>`).join('')}
      <div class="sidebar-spacer"></div><div class="sidebar-foot"><p><strong>Frontend protected</strong><br>Content is managed separately from the public site design.</p></div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div class="crumbs"><button type="button" class="mobile-menu" data-action="mobile-menu" aria-label="Open navigation">${icon('menu')}</button><span>Mewepak</span><span>›</span><strong>${esc(pageTitle(activeSection))}</strong></div>
        <div class="top-actions"><span class="env-pill"><span class="env-dot"></span>Connected workspace</span><div class="user-chip"><span class="user-avatar">${esc(initial)}</span><span class="user-name">${esc(email)}</span><button type="button" class="icon-btn" data-action="signout" aria-label="Sign out">${icon('logout')}</button></div></div>
      </header>
      <section class="content">${content}</section>
    </main>
  </div>`;
}

function heading(title, description, action = '') {
  return `<div class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>`;
}

function emptyState(title, message) {
  return `<div class="empty-state"><span class="empty-icon">${icon('layers')}</span><strong>${esc(title)}</strong><span>${esc(message)}</span></div>`;
}

function errorState(message) {
  return `<div class="error-box">${esc(message)}</div>`;
}

async function queryTable(table, select = '*', sort = 'created_at', ascending = false) {
  const result = await supabase.from(table).select(select).order(sort, { ascending });
  if (result.error) throw result.error;
  return result.data || [];
}

async function countTable(table, filters = []) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  for (const [key, value] of filters) query = query.eq(key, value);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function renderOverview() {
  let counts;
  try {
    counts = await Promise.all([
      countTable('product_categories'), countTable('products'), countTable('pages'), countTable('appointments', [['status', 'pending']]),
    ]);
  } catch (error) {
    return `${heading('Welcome to Mewepak Studio', 'The admin is connected, but its tables are not ready yet.')}${errorState(`Run database/schema.sql in the Supabase SQL Editor, then refresh. ${error.message || ''}`)}`;
  }
  return `${heading('Welcome to Mewepak Studio', 'A focused workspace for the packaging catalog, site content, and customer requests.')}
    <div class="kpi-grid">
      ${[['Product categories', counts[0], 'catalog groups', 'layers'], ['Products', counts[1], 'showcase records', 'box'], ['Pages', counts[2], 'managed pages', 'file'], ['Pending bookings', counts[3], 'awaiting confirmation', 'calendar']].map(([label, value, sub, ico]) => `<article class="card kpi"><div class="kpi-top"><span>${label}</span><span class="kpi-icon">${icon(ico)}</span></div><div class="kpi-value">${value}</div><div class="kpi-caption">${sub}</div></article>`).join('')}
    </div>
    <div class="banner"><div class="banner-copy"><span class="banner-mark">M</span><div><h2>The existing frontend stays separate</h2><p>Use this admin to change content and product data. Theme templates and visual styles remain in the protected frontend project.</p></div></div><button type="button" class="btn btn-plain" data-section="categories">Review categories ${icon('arrow')}</button></div>
    <div class="dashboard-grid"><section class="card card-pad"><div class="card-title-row"><div><h2 class="card-title">Quick actions</h2><p class="card-note">Common catalog and content tasks.</p></div></div><div class="quick-list">
      ${[['categories','Organize product categories','Set the two menu groups, images, and order','layers'],['products','Add a product showcase','Manage product images and packaging options','box'],['pages','Edit a website page','Update page content and SEO fields','file'],['models','Manage 3D preview assets','Upload GLB files and assign product models','cube']].map(([id,title,sub,ico])=>`<button class="quick-link" type="button" data-section="${id}"><span class="quick-left"><span class="quick-icon">${icon(ico)}</span><span><span class="quick-title">${title}</span><span class="quick-sub">${sub}</span></span></span><span class="quick-arrow">›</span></button>`).join('')}
    </div></section><section class="card card-pad"><div class="card-title-row"><div><h2 class="card-title">Frontend menu structure</h2><p class="card-note">Manage the menu taxonomy shown in your screenshot.</p></div></div><div class="quick-list"><div class="quick-link"><span class="quick-left"><span class="quick-icon">${icon('layers')}</span><span><span class="quick-title">Pouch Formats</span><span class="quick-sub">Stand-up, flat-bottom, retort, spout, films</span></span></span></div><div class="quick-link"><span class="quick-left"><span class="quick-icon">${icon('box')}</span><span><span class="quick-title">Specialty Packaging</span><span class="quick-sub">Quad seal, flat pouch, shaped pouch</span></span></span></div></div></section></div>`;
}

function categoryPreview(rows) {
  const visible = rows.filter((row) => row.show_in_menu && row.status === 'published');
  const groups = [['pouch-formats', 'Pouch Formats'], ['specialty-packaging', 'Specialty Packaging']];
  return `<div class="menu-preview">${groups.map(([key,label]) => {
    const items = visible.filter((row) => row.menu_group === key).sort((a,b) => a.menu_order - b.menu_order || a.name.localeCompare(b.name));
    return `<section class="card preview-group"><h3>${esc(label)} <span class="preview-count">${items.length} items</span></h3><div class="preview-items">${items.length ? items.map((row) => `<div class="preview-item"><span class="preview-thumb">${row.image_url ? `<img src="${esc(row.image_url)}" alt="">` : esc(row.name.slice(0,1))}</span><span class="preview-name" title="${esc(row.name)}">${esc(row.name)}</span></div>`).join('') : '<span class="row-secondary">No visible categories</span>'}</div></section>`;
  }).join('')}</div>`;
}

function tableHead(columns) {
  const labels = {
    name: 'Name', group: 'Menu group', slug: 'URL slug', menu: 'Menu visibility', order: 'Order',
    category: 'Category', status: 'Status', title: 'Title', template_key: 'Template', published_at: 'Publish date',
    model_url: 'Model file', product: 'Product', file_name: 'File', mime_type: 'Type', public_url: 'URL',
    key: 'Key', value: 'Value', is_public: 'Public', contact_name: 'Contact', company: 'Company', email: 'Email',
    created_at: 'Created', booking_date: 'Date', slot_start: 'Time', meeting_type: 'Meeting type', topic: 'Topic',
    alt_text: 'Alt text',
  };
  return `<thead><tr>${columns.map((column) => `<th>${esc(labels[column] || column)}</th>`).join('')}<th style="text-align:right">Actions</th></tr></thead>`;
}

function statusBadge(status) {
  return `<span class="badge ${esc(String(status || '').toLowerCase())}">${esc(String(status || 'unknown').replaceAll('_',' '))}</span>`;
}

function groupChip(group) {
  const label = group === 'specialty-packaging' ? 'Specialty Packaging' : 'Pouch Formats';
  return `<span class="group-chip${group === 'specialty-packaging' ? ' specialty' : ''}">${label}</span>`;
}

function actionsFor(module, id, allowDelete = true) {
  return `<div class="actions"><button class="icon-btn" type="button" data-action="edit" data-module="${esc(module)}" data-id="${esc(id)}" aria-label="Edit">${icon('edit')}</button>${allowDelete ? `<button class="icon-btn" type="button" data-action="delete" data-module="${esc(module)}" data-id="${esc(id)}" aria-label="Delete">${icon('trash')}</button>` : ''}</div>`;
}

function rowFor(module, row) {
  const id = esc(row.id || row.key);
  if (module === 'categories') return `<tr><td><div class="row-primary">${esc(row.name)}</div><div class="row-secondary">${esc(row.short_description || '')}</div></td><td>${groupChip(row.menu_group)}</td><td>${esc(row.slug)}</td><td>${row.show_in_menu ? '<span class="badge published">Visible</span>' : '<span class="badge archived">Hidden</span>'}</td><td>${Number(row.menu_order || 0)}</td><td>${actionsFor(module,id)}</td></tr>`;
  if (module === 'products') return `<tr><td><div class="row-product"><span class="product-thumb">${row.primary_image_url ? `<img src="${esc(row.primary_image_url)}" alt="">` : esc((row.name || 'P').slice(0,1))}</span><span><span class="row-primary">${esc(row.name)}</span><span class="row-secondary">${esc(row.short_description || '')}</span></span></div></td><td>${esc(row.category?.name || 'Unassigned')}</td><td>${esc(row.slug)}</td><td>${statusBadge(row.status)}</td><td>${actionsFor(module,id)}</td></tr>`;
  if (module === 'pages') return `<tr><td><div class="row-primary">${esc(row.title)}</div><div class="row-secondary">${esc(row.summary || '')}</div></td><td>${esc(row.slug)}</td><td>${esc(row.template_key)}</td><td>${statusBadge(row.status)}</td><td>${actionsFor(module,id)}</td></tr>`;
  if (module === 'articles') return `<tr><td><div class="row-primary">${esc(row.title)}</div><div class="row-secondary">${esc(row.excerpt || '')}</div></td><td>${esc(row.slug)}</td><td>${formatDate(row.published_at)}</td><td>${statusBadge(row.status)}</td><td>${actionsFor(module,id)}</td></tr>`;
  if (module === 'models') return `<tr><td><div class="row-primary">${esc(row.name)}</div><div class="row-secondary">${esc(row.model_url || '')}</div></td><td>${row.product?.name ? esc(row.product.name) : 'Unassigned'}</td><td>${statusBadge(row.status)}</td><td>${actionsFor(module,id)}</td></tr>`;
  if (module === 'media') return `<tr><td><div class="row-primary">${esc(row.file_name)}</div><div class="row-secondary">${esc(row.alt_text || '')}</div></td><td>${esc(row.mime_type || '—')}</td><td><a href="${esc(row.public_url)}" target="_blank" rel="noopener">Open file ${icon('external')}</a></td><td>${formatDate(row.created_at)}</td><td>${actionsFor(module,id)}</td></tr>`;
  if (module === 'settings') return `<tr><td><div class="row-primary">${esc(row.key)}</div></td><td><div class="row-secondary">${esc(JSON.stringify(row.value).slice(0,100))}</div></td><td>${row.is_public ? '<span class="badge published">Public</span>' : '<span class="badge archived">Private</span>'}</td><td>${actionsFor(module,id,false)}</td></tr>`;
  if (module === 'inquiries') return `<tr><td><div class="row-primary">${esc(row.contact_name)}</div><div class="row-secondary">${esc(row.phone || '')}</div></td><td>${esc(row.company || '—')}</td><td>${esc(row.email)}</td><td><select class="select-small" data-action="inquiry-status" data-id="${id}">${[['new','New'],['in_progress','In progress'],['replied','Replied'],['closed','Closed']].map(([v,l])=>`<option value="${v}"${row.status===v?' selected':''}>${l}</option>`).join('')}</select></td><td>${formatDate(row.created_at)}</td><td><span class="row-secondary">—</span></td></tr>`;
  return '';
}

async function renderListModule(module) {
  const definition = definitions[module];
  try {
    let rows;
    if (module === 'products') {
      const result = await supabase.from('products').select('*, category:product_categories(name)').order('sort_order').order('name');
      if (result.error) throw result.error;
      rows = result.data || [];
      cachedProducts = rows;
    } else if (module === 'models') {
      const result = await supabase.from('model_assets').select('*, product:products(name)').order('sort_order').order('name');
      if (result.error) throw result.error;
      rows = result.data || [];
    } else {
      rows = await queryTable(definition.table, '*', module === 'categories' ? 'menu_order' : 'created_at', module === 'categories');
    }
    moduleState.set(module, rows);
    if (module === 'categories') cachedCategories = rows;
    const title = definition.title;
    const addButton = definition.add ? `<button type="button" class="btn btn-primary" data-action="add" data-module="${module}">${icon('plus')}${esc(definition.add)}</button>` : '';
    const menu = module === 'categories' ? categoryPreview(rows) : '';
    const rowsHtml = rows.map((row) => rowFor(module,row)).join('');
    const table = rows.length ? `<div class="table-wrap"><table>${tableHead(definition.columns)}<tbody>${rowsHtml}</tbody></table></div>` : emptyState(`No ${definition.singular}s yet`, `Add a ${definition.singular} to start managing this section.`);
    return `${heading(title, definition.description, addButton)}${menu}<section class="card"><div class="toolbar"><div class="toolbar-left"><label class="search-box">${icon('search')}<input id="list-search" type="search" placeholder="Search ${esc(definition.title.toLowerCase())}" aria-label="Search ${esc(definition.title)}"></label></div><div class="toolbar-right"><span class="row-secondary">${rows.length} records</span></div></div>${table}</section>`;
  } catch (error) {
    return `${heading(definition.title, definition.description)}${errorState(`Could not load ${definition.title.toLowerCase()}. ${error.message || 'Check the database setup and staff access.'}`)}`;
  }
}

async function renderAppointments() {
  const definition = { title: 'Appointments', description: 'Review consultation requests, confirm a time, and update booking status.' };
  try {
    const rows = await queryTable('appointments', '*', 'booking_date');
    moduleState.set('appointments', rows);
    const sorted = [...rows].sort((a,b) => `${b.booking_date}${b.slot_start}`.localeCompare(`${a.booking_date}${a.slot_start}`));
    const table = sorted.length ? `<div class="table-wrap"><table><thead><tr><th>Contact</th><th>Company</th><th>Date & time</th><th>Meeting</th><th>Topic</th><th>Status</th></tr></thead><tbody>${sorted.map((row) => `<tr><td><div class="row-primary">${esc(row.contact_name)}</div><div class="row-secondary">${esc(row.email)} · ${esc(row.phone)}</div></td><td>${esc(row.company || '—')}</td><td>${esc(row.booking_date)}<div class="row-secondary">${esc(String(row.slot_start).slice(0,5))}–${esc(String(row.slot_end).slice(0,5))}</div></td><td>${row.meeting_type === 'factory_visit' ? 'Factory visit' : 'Video call'}</td><td>${esc(row.topic || '—')}</td><td><select class="select-small" data-action="booking-status" data-id="${esc(row.id)}">${[['pending','Pending'],['confirmed','Confirmed'],['cancelled','Cancelled'],['completed','Completed']].map(([v,l])=>`<option value="${v}"${row.status===v?' selected':''}>${l}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>` : emptyState('No appointments yet', 'New consultation requests will appear here after the public booking endpoint is connected.');
    return `${heading(definition.title, definition.description, '<button type="button" class="btn btn-plain" data-section="booking-settings">Manage schedule</button>')}<section class="card">${table}</section>`;
  } catch (error) {
    return `${heading(definition.title, definition.description)}${errorState(`Could not load appointments. ${error.message || ''}`)}`;
  }
}

async function renderBookingSettings() {
  try {
    const { data, error } = await supabase.from('booking_settings').select('*').eq('id', 1).single();
    if (error) throw error;
    const selected = new Set(data.working_days || []);
    const days = [[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri'],[6,'Sat'],[7,'Sun']];
    return `${heading('Booking schedule', 'Set consultation days, hours, appointment length, and booking limits.')}
      <form class="card card-pad" id="schedule-form"><div class="field-grid">
        <div class="field full"><label>Working days</label><div class="day-picker">${days.map(([n,label])=>`<label class="checkbox-field"><input type="checkbox" name="working_days" value="${n}"${selected.has(n)?' checked':''}><span>${label}</span></label>`).join('')}</div></div>
        <div class="field"><label for="schedule-start">Start time</label><input class="control" id="schedule-start" name="start_time" type="time" value="${esc(String(data.start_time).slice(0,5))}" required></div>
        <div class="field"><label for="schedule-end">End time</label><input class="control" id="schedule-end" name="end_time" type="time" value="${esc(String(data.end_time).slice(0,5))}" required></div>
        <div class="field"><label for="slot-minutes">Appointment length</label><select class="control" id="slot-minutes" name="slot_minutes">${[30,45,60,90,120].map((n)=>`<option value="${n}"${Number(data.slot_minutes)===n?' selected':''}>${n} minutes</option>`).join('')}</select></div>
        <div class="field"><label for="max-per-slot">Bookings per time slot</label><input class="control" id="max-per-slot" name="max_per_slot" type="number" min="1" max="20" value="${Number(data.max_per_slot)}"></div>
        <div class="field"><label for="advance-days">Book up to (days ahead)</label><input class="control" id="advance-days" name="advance_days" type="number" min="1" max="365" value="${Number(data.advance_days)}"></div>
        <div class="field"><label for="timezone">Business timezone</label><input class="control" id="timezone" name="timezone" value="${esc(data.timezone)}" required></div>
      </div><div style="display:flex;justify-content:flex-end;margin-top:20px"><button class="btn btn-primary" type="submit">Save schedule</button></div></form>`;
  } catch (error) {
    return `${heading('Booking schedule', 'Set consultation days and time slots.')}${errorState(`Could not load the schedule. ${error.message || ''}`)}`;
  }
}

async function renderPanel() {
  if (activeSection === 'overview') return renderOverview();
  if (activeSection === 'appointments') return renderAppointments();
  if (activeSection === 'booking-settings') return renderBookingSettings();
  if (definitions[activeSection]) return renderListModule(activeSection);
  return emptyState('Section unavailable', 'This section is not available yet.');
}

async function renderApp() {
  if (!currentUser) return loginView();
  const currentToken = ++renderToken;
  const body = await renderPanel();
  if (currentToken !== renderToken) return;
  app.innerHTML = shellMarkup(body);
  bindShellEvents();
}

function bindShellEvents() {
  app.querySelectorAll('[data-section]').forEach((button) => button.addEventListener('click', async () => {
    activeSection = button.dataset.section;
    document.querySelector('#sidebar')?.classList.remove('open');
    await renderApp();
  }));
  app.querySelector('[data-action="mobile-menu"]')?.addEventListener('click', () => document.querySelector('#sidebar')?.classList.toggle('open'));
  app.querySelector('[data-action="reload"]')?.addEventListener('click', () => location.reload());
  app.querySelector('[data-action="signout"]')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    currentUser = null;
    loginView();
  });
  app.querySelectorAll('[data-action="add"]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.module)));
  app.querySelectorAll('[data-action="edit"]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.module, button.dataset.id)));
  app.querySelectorAll('[data-action="delete"]').forEach((button) => button.addEventListener('click', () => deleteRecord(button.dataset.module, button.dataset.id)));
  app.querySelectorAll('[data-action="booking-status"],[data-action="inquiry-status"]').forEach((select) => select.addEventListener('change', async () => updateStatus(select.dataset.action === 'booking-status' ? 'appointments' : 'inquiries', select.dataset.id, select.value)));
  app.querySelector('#list-search')?.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    app.querySelectorAll('tbody tr').forEach((row) => { row.hidden = query && !row.textContent.toLowerCase().includes(query); });
  });
  app.querySelector('#schedule-form')?.addEventListener('submit', saveSchedule);
}

function fieldValue(item, field) {
  if (item[field.name] !== undefined && item[field.name] !== null) return item[field.name];
  if (field.type === 'json') return field.name === 'sections' ? [] : {};
  if (field.type === 'array') return [];
  return field.value ?? '';
}

function renderEditorField(field, item) {
  const value = fieldValue(item, field);
  const name = esc(field.name);
  const id = `field-${name}`;
  let input = '';
  if (field.type === 'checkbox') {
    input = `<label class="checkbox-field"><input id="${id}" type="checkbox" name="${name}"${value ? ' checked' : ''}><span>${esc(field.label)}</span></label>`;
    return `<div class="field${field.full ? ' full' : ''}">${input}${field.help ? `<span class="field-help">${esc(field.help)}</span>` : ''}</div>`;
  }
  if (field.type === 'select') {
    const opts = (field.options || []).map(([optionValue,label]) => `<option value="${esc(optionValue)}"${String(value)===String(optionValue)?' selected':''}>${esc(label)}</option>`).join('');
    input = `<select class="control" id="${id}" name="${name}"${field.required?' required':''}>${opts}</select>`;
  } else if (field.type === 'category' || field.type === 'product') {
    const records = field.type === 'category' ? cachedCategories : cachedProducts;
    input = `<select class="control" id="${id}" name="${name}"><option value="">Unassigned</option>${records.map((row)=>`<option value="${esc(row.id)}"${String(value)===String(row.id)?' selected':''}>${esc(row.name)}</option>`).join('')}</select>`;
  } else if (field.type === 'textarea' || field.type === 'array' || field.type === 'json') {
    let text = value;
    if (field.type === 'array') text = Array.isArray(value) ? value.join('\n') : String(value || '');
    if (field.type === 'json') text = JSON.stringify(value ?? (field.name === 'sections' ? [] : {}), null, 2);
    input = `<textarea class="control${field.type==='json'?' json-field':''}" id="${id}" name="${name}"${field.required?' required':''}>${esc(text)}</textarea>`;
  } else if (field.type === 'file') {
    input = `<input class="control" id="${id}" type="file" name="${name}" accept="${esc(field.accept || '*/*')}">`;
  } else {
    let inputValue = value;
    if (field.type === 'datetime-local' && value) inputValue = String(value).slice(0,16);
    input = `<input class="control" id="${id}" type="${esc(field.type || 'text')}" name="${name}" value="${esc(inputValue)}"${field.required?' required':''}${field.min!==undefined?` min="${field.min}"`:''}>`;
  }
  return `<div class="field${field.full ? ' full' : ''}"><label for="${id}">${esc(field.label)}${field.required ? ' *' : ''}</label>${input}${field.help ? `<span class="field-help">${esc(field.help)}</span>` : ''}</div>`;
}

async function openEditor(module, id = '') {
  const definition = definitions[module];
  if (!definition) return;
  let item = {};
  if (id) {
    const rows = moduleState.get(module) || [];
    item = rows.find((row) => String(row.id || row.key) === String(id)) || {};
  }
  if (module === 'products' || module === 'models') {
    try { cachedCategories = await queryTable('product_categories','*','menu_order',true); } catch { cachedCategories = []; }
    if (module === 'models') {
      try { cachedProducts = await queryTable('products','*','name'); } catch { cachedProducts = []; }
    }
  }
  const dialogTitle = id ? `Edit ${definition.singular}` : definition.add;
  dialog.innerHTML = `<form id="editor-form" data-module="${esc(module)}" data-id="${esc(id)}"><div class="dialog-head"><div><h2>${esc(dialogTitle)}</h2><p>Changes are saved to the protected content database.</p></div><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div><div class="dialog-body"><div class="field-grid">${definition.fields.map((field)=>renderEditorField(field,item)).join('')}</div><div id="form-error" class="error-box" style="display:none;margin-top:14px"></div></div><div class="dialog-foot"><button type="button" class="btn btn-plain" data-close>Cancel</button><button type="submit" class="btn btn-primary">Save changes</button></div></form>`;
  dialog.querySelectorAll('[data-close]').forEach((button)=>button.addEventListener('click',()=>dialog.close()));
  dialog.querySelector('#editor-form').addEventListener('submit', saveEditor);
  dialog.querySelectorAll('input[type="file"]').forEach((input) => input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    if (module === 'media') {
      const fileName = dialog.querySelector('[name="file_name"]');
      const mimeType = dialog.querySelector('[name="mime_type"]');
      if (fileName && !fileName.value) fileName.value = file.name;
      if (mimeType && !mimeType.value) mimeType.value = file.type;
    }
  }));
  dialog.showModal();
}

async function uploadFile(file, folder) {
  const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-120) || 'asset';
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from('site-media').upload(path, file, {
    cacheControl: '31536000', upsert: false, contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;
  return supabase.storage.from('site-media').getPublicUrl(path).data.publicUrl;
}

async function saveEditor(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const module = form.dataset.module;
  const id = form.dataset.id;
  const definition = definitions[module];
  const payload = {};
  const errorBox = form.querySelector('#form-error');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    for (const field of definition.fields) {
      const element = form.elements.namedItem(field.name);
      if (field.type === 'file') {
        const file = element?.files?.[0];
        if (file) payload[field.target] = await uploadFile(file, field.folder);
        continue;
      }
      if (field.type === 'checkbox') { payload[field.name] = Boolean(element?.checked); continue; }
      let value = element?.value ?? '';
      if (field.type === 'number') value = value === '' ? 0 : Number(value);
      if (field.type === 'array') value = value.split('\n').map((part)=>part.trim()).filter(Boolean);
      if (field.type === 'json') {
        try { value = JSON.parse(value || (field.name === 'sections' ? '[]' : '{}')); }
        catch { throw new Error(`${field.label} must contain valid JSON.`); }
      }
      if (field.type === 'datetime-local') value = value ? new Date(value).toISOString() : null;
      if ((field.type === 'category' || field.type === 'product') && value === '') value = null;
      if (value !== '' || ['textarea','array','json','select'].includes(field.type) || field.name === 'value') payload[field.name] = value;
    }
    if (module === 'media' && !payload.file_name) {
      const file = form.elements.namedItem('_upload')?.files?.[0];
      if (file) payload.file_name = file.name;
    }
    if (module !== 'media') payload.updated_at = new Date().toISOString();
    const table = definition.table;
    let result;
    if (id) {
      result = await supabase.from(table).update(payload).eq(module === 'settings' ? 'key' : 'id', id);
    } else {
      result = await supabase.from(table).insert(payload);
    }
    if (result.error) throw result.error;
    dialog.close();
    showToast(`${definition.singular[0].toUpperCase()}${definition.singular.slice(1)} saved.`);
    await renderApp();
  } catch (error) {
    errorBox.textContent = error.message || 'Could not save this record.';
    errorBox.style.display = 'block';
    button.disabled = false;
    button.textContent = 'Save changes';
  }
}

async function deleteRecord(module, id) {
  const definition = definitions[module];
  if (!definition || !window.confirm(`Delete this ${definition.singular}?`)) return;
  const key = module === 'settings' ? 'key' : 'id';
  const { error } = await supabase.from(definition.table).delete().eq(key,id);
  if (error) return showToast(error.message || 'Delete failed.', true);
  showToast(`${definition.singular[0].toUpperCase()}${definition.singular.slice(1)} deleted.`);
  await renderApp();
}

async function updateStatus(table, id, status) {
  const { error } = await supabase.from(table).update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return showToast(error.message || 'Status update failed.', true);
  showToast('Status updated.');
  await renderApp();
}

async function saveSchedule(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    id: 1,
    working_days: data.getAll('working_days').map(Number).sort((a,b)=>a-b),
    start_time: data.get('start_time'),
    end_time: data.get('end_time'),
    slot_minutes: Number(data.get('slot_minutes')),
    max_per_slot: Number(data.get('max_per_slot')),
    advance_days: Number(data.get('advance_days')),
    timezone: String(data.get('timezone')).trim(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('booking_settings').upsert(payload);
  if (error) return showToast(error.message || 'Could not save schedule.', true);
  showToast('Booking schedule saved.');
}

async function bootstrap() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    const config = await response.json().catch(() => null);
    if (!response.ok || !config?.configured) return setupView();
    supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    });
    const { data, error } = await supabase.auth.getSession();
    if (error) return loginView('Could not restore your session. Sign in again.');
    if (data.session) {
      const { data: userData } = await supabase.auth.getUser();
      if (!isStaff(userData?.user)) return loginView('This account does not have Mewepak staff access.');
      currentUser = userData.user;
      await renderApp();
    } else {
      loginView();
    }
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        currentUser = null;
        window.setTimeout(() => loginView(), 0);
      }
    });
  } catch (error) {
    app.innerHTML = `<div class="signin-wrap"><section class="setup-card"><h1>Admin connection unavailable</h1><p>${esc(error.message || 'Check that the Pages Functions are deployed and configured.')}</p><button class="btn btn-primary" type="button" data-action="reload">Try again</button></section></div>`;
  }
}

bootstrap();
