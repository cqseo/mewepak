# Mewepak Studio

独立于现有 WordPress 前端的内容管理后台，适用于产品展示型包装厂网站。当前版本提供分类、产品、页面、文章、媒体、3D 资源、站点设置、询价和预约管理的后台骨架，以及安全的预约可用时段/提交接口。

## 当前范围

- `public/admin/` 是独立后台界面，不包含也不覆盖现有 WordPress 主题或前端文件。
- `database/schema.sql` 初始化 Supabase 表、RLS 策略、媒体桶和预约写入函数，并按现有产品菜单种入 12 个分类。
- `functions/` 是 Cloudflare Pages Functions：读取公开配置、返回可预约时段、验证 Turnstile 并创建预约。
- 页面使用结构化 JSON 区块记录内容。前端模板与样式仍需按现有网站的页面结构接入，避免在接入前改变线上页面。

此仓库没有现有前端代码或 Supabase 项目凭证，因此该版本还没有导入 WordPress 页面/产品，也没有连接线上网站的前台展示。它不会自行改动当前线上 WordPress 站点。

## 本地目录

```text
database/schema.sql       Supabase 一次性初始化脚本
functions/api/            Cloudflare Pages API routes
functions/lib/http.js     API 共享函数
public/admin/             独立管理后台
public/_headers           管理后台安全响应头
```

## 配置 Supabase

1. 在 Supabase 建立项目，并在 Authentication 中创建后台员工账号；关闭公开注册。
2. 在 SQL Editor 执行 `database/schema.sql`。这份脚本可以重复执行，用于更新策略和补齐表结构；执行前仍应先确认目标项目。
3. 给经批准的账号添加 `admin` 或 `editor` 角色。先创建用户，再以项目管理员身份执行：

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('role', 'admin')
   where email = 'admin@example.com';
   ```

   角色写在受信任的 `app_metadata` 中；后台登录和数据库 RLS 都会检查这个角色。不要把权限角色放到用户可自行编辑的 `user_metadata`。

4. 保存 Project URL、Publishable key（旧项目可使用 anon key）、服务端 Secret/service role key。服务端密钥只放入 Cloudflare Pages Functions 的加密环境变量。
5. Turnstile 预约验证在公开预约表单接入时启用。Cloudflare 的 Site key 需要放入公开预约表单；Secret key 只放入服务端环境变量。

## Cloudflare Pages 部署

将仓库连接到 Cloudflare Pages，根目录设为仓库根目录，静态输出目录设为 `public`，无需构建步骤。Pages Functions 会从根目录下的 `functions/` 加载。

为 Preview 和 Production 环境分别设置以下变量：

| 变量 | 用途 |
| --- | --- |
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | 返回给后台登录页的公开 key |
| `SUPABASE_SERVICE_ROLE_KEY` | Pages Functions 专用服务端 key；绝不能放在浏览器代码或公开变量中 |
| `TURNSTILE_SECRET_KEY` | 预约提交的服务端验证密钥 |

本地使用时，把 `.dev.vars.example` 复制为 `.dev.vars` 并填写开发环境值。`.dev.vars` 已加入 Git 忽略规则。

后台入口为 `/admin/`。站点暂未配置时会显示连接说明；完成变量配置和 SQL 初始化后，可使用已创建并授权角色的账号登录。

## 预约接口

### 查询可约时段

```http
GET /api/booking-slots?date=YYYY-MM-DD
```

返回日期、时区和剩余时段列表；接口不会返回已有预约人的资料。

### 提交预约

```http
POST /api/bookings
Content-Type: application/json

{
  "name": "Contact name",
  "company": "Company name",
  "email": "contact@example.com",
  "phone": "+1 555 010 1234",
  "topic": "Packaging request",
  "meeting_type": "video_call",
  "date": "2026-12-01",
  "time": "10:00",
  "turnstile_token": "token-from-the-public-form"
}
```

接口会检查同源请求、输入格式、Turnstile、工作日/预约时段和时段容量。数据库函数在事务锁内再次检查容量并写入预约，减少多人同时提交时的超额预约。公开预约表单与邮件通知尚未接入现有 WordPress 前端。

## 前台接入边界

现有前端需要一层明确的数据映射，才能安全连接此 CMS。正式替换数据源前，需要把现有主题/前端代码纳入仓库或提供其接口，并确认每类内容的字段和模板映射。此后台的页面内容先按 `pages.sections` 结构化保存；前端模板未确认前，不会把任意页面内容直接输出到线上。

产品菜单默认按截图中的两组分类管理：`Pouch Formats` 和 `Specialty Packaging`。发布状态、菜单可见性、分组与排序分别保存，便于后续映射到现有导航。
