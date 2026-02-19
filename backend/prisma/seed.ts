import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const milestones = [
    {
      id: 1,
      name: 'GitHubアカウント作成',
      description: 'GitHub OAuth認証によりアカウント存在を確認',
      stepOrder: 1,
      githubVerificationType: 'account',
    },
    {
      id: 2,
      name: 'リポジトリ作成',
      description: 'GitHub APIでリポジトリ作成を確認',
      stepOrder: 2,
      githubVerificationType: 'repository',
    },
    {
      id: 3,
      name: '最初のコミット',
      description: 'GitHub APIでコミット履歴を確認',
      stepOrder: 3,
      githubVerificationType: 'commit',
    },
    {
      id: 4,
      name: 'プルリクエスト作成',
      description: 'GitHub APIでPR作成を確認',
      stepOrder: 4,
      githubVerificationType: 'pull_request',
    },
    {
      id: 5,
      name: 'CI/CD設定',
      description: 'GitHub ActionsワークフローのRunを確認',
      stepOrder: 5,
      githubVerificationType: 'workflow_run',
    },
  ];

  for (const milestone of milestones) {
    await prisma.milestoneDefinition.upsert({
      where: { id: milestone.id },
      update: milestone,
      create: milestone,
    });
  }

  console.log('Seeded 5 milestone definitions');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
