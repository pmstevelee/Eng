{\rtf1\ansi\ansicpg949\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # EduLevel LMS - \uc0\u54532 \u47196 \u51229 \u53944  \u44508 \u52825 \
\
## \uc0\u44592 \u49696  \u49828 \u53469  (\u51208 \u45824  \u48320 \u44221  \u44552 \u51648 )\
- Next.js 14 (App Router) + TypeScript\
- Tailwind CSS + shadcn/ui\
- Supabase (PostgreSQL) + Supabase Auth\
- Prisma ORM\
- Vercel \uc0\u48176 \u54252 \
- OpenAI API (GPT-4o-mini)\
\
## \uc0\u53076 \u46300  \u44508 \u52825 \
- \uc0\u47784 \u46304  \u52980 \u54252 \u45324 \u53944 \u45716  TypeScript (.tsx)\
- Server Components \uc0\u50864 \u49440  \u49324 \u50857 , \u53364 \u46972 \u51060 \u50616 \u53944  \u54596 \u50836  \u49884 \u47564  "use client"\
- Server Actions \uc0\u49324 \u50857  (API Routes\u45716  \u50808 \u48512  \u50672 \u46041 \u47564 )\
- \uc0\u54620 \u44397 \u50612  UI (\u50640 \u47084  \u47700 \u49884 \u51648 , \u46972 \u48296 , \u48260 \u53948  \u47784 \u46160  \u54620 \u44397 \u50612 )\
- shadcn/ui \uc0\u52980 \u54252 \u45324 \u53944  \u50864 \u49440  \u49324 \u50857 \
- \uc0\u54028 \u51068 \u47749 : kebab-case (\u50696 : student-list.tsx)\
- \uc0\u54632 \u49688 \u47749 : camelCase\
- \uc0\u53440 \u51077 \u47749 : PascalCase\
\
## \uc0\u54260 \u45908  \u44396 \u51312 \
- src/app/(auth)/ : \uc0\u47196 \u44536 \u51064  \u44288 \u47144 \
- src/app/(dashboard)/owner/ : \uc0\u54617 \u50896 \u51109  \u54168 \u51060 \u51648 \
- src/app/(dashboard)/teacher/ : \uc0\u44368 \u49324  \u54168 \u51060 \u51648 \
- src/app/(dashboard)/student/ : \uc0\u54617 \u49373  \u54168 \u51060 \u51648 \
- src/components/ui/ : shadcn/ui\
- src/components/shared/ : \uc0\u44277 \u53685  \u52980 \u54252 \u45324 \u53944 \
- src/lib/ : \uc0\u50976 \u54008 \u47532 \u54000 , Supabase, Prisma \u53364 \u46972 \u51060 \u50616 \u53944 \
- src/types/ : TypeScript \uc0\u53440 \u51077 \
- src/hooks/ : \uc0\u52964 \u49828 \u53568  \u54981 \
\
## DB\
- Prisma \uc0\u49828 \u53412 \u47560 : prisma/schema.prisma\
- \uc0\u47560 \u51060 \u44536 \u47112 \u51060 \u49496 : npx prisma migrate dev --name \u49444 \u47749 \
- Supabase RLS \uc0\u51221 \u52293  \u51201 \u50857 \u46120 \
\
## \uc0\u49324 \u50857 \u51088  \u50669 \u54624  (4\u44060 \u47564 , \u54617 \u48512 \u47784  \u50630 \u51020 )\
- SUPER_ADMIN: \uc0\u51204 \u52404  \u44288 \u47532 \
- ACADEMY_OWNER: \uc0\u54617 \u50896  \u44288 \u47532 \
- TEACHER: \uc0\u53580 \u49828 \u53944 /\u54617 \u49373  \u44288 \u47532 \
- STUDENT: \uc0\u53580 \u49828 \u53944  \u51025 \u49884 /\u54617 \u49845 \
\
## \uc0\u51208 \u45824  \u54616 \u51648  \u47568  \u44163 \
- \uc0\u49352 \u47196 \u50868  \u46972 \u51060 \u48652 \u47084 \u47532 \u47484  \u49444 \u52824 \u54616 \u44592  \u51204 \u50640  \u48152 \u46300 \u49884  \u47932 \u50612 \u48380  \u44163 \
- \uc0\u44592 \u51316  \u54028 \u51068 \u51012  \u49325 \u51228 \u54616 \u51648  \u47568  \u44163  (\u49688 \u51221 \u47564 )\
- .env \uc0\u54028 \u51068 \u51012  Git\u50640  \u52964 \u48139 \u54616 \u51648  \u47568  \u44163 \
- any \uc0\u53440 \u51077  \u49324 \u50857  \u44552 \u51648 }