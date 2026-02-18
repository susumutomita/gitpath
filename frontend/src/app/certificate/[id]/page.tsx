import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Github, Award } from "lucide-react";

interface CertificatePageProps {
  params: Promise<{ id: string }>;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

interface CertificateData {
  id: string;
  githubUsername: string;
  completedAt: string;
  elapsedSeconds: number;
  milestoneDetails: { name: string; completedAt: string | null }[];
}

async function getCertificateData(id: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/certificates/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data: CertificateData = await res.json();
    return {
      id: data.id,
      githubUsername: data.githubUsername,
      completedAt: data.completedAt,
      elapsedMinutes: Math.round(data.elapsedSeconds / 60),
      milestones: data.milestoneDetails.map(
        (m: { name: string; completedAt: string | null }) => ({
          name: m.name,
          completed: !!m.completedAt,
        })
      ),
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: CertificatePageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getCertificateData(id);

  if (!data) {
    return { title: "証明書が見つかりません - GitPath" };
  }

  const title = `${data.githubUsername}さんのGitPath達成証明`;
  const description = `${data.githubUsername}さんはGitPathで全5マイルストーンを${data.elapsedMinutes}分で達成しました!`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CertificatePage({
  params,
}: CertificatePageProps) {
  const { id } = await params;
  const data = await getCertificateData(id);

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            証明書が見つかりません
          </h1>
          <p className="mt-2 text-base text-gray-600">
            指定された証明書は存在しないか、削除された可能性があります。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-12">
      <Card className="w-full max-w-lg overflow-hidden border-2 border-blue-200 shadow-lg">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-center text-white">
          <Award className="mx-auto mb-3 h-12 w-12" aria-hidden="true" />
          <h1 className="text-2xl font-bold">Git学習 達成証明</h1>
          <p className="mt-1 text-blue-100">GitPath Completion Certificate</p>
        </div>

        <CardContent className="p-6">
          {/* GitHub Username */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2">
              <Github className="h-5 w-5 text-gray-700" aria-hidden="true" />
              <span className="text-lg font-semibold text-gray-900">
                {data.githubUsername}
              </span>
            </div>
          </div>

          {/* Milestones */}
          <div className="mb-6">
            <h2 className="mb-3 text-center text-sm font-medium uppercase tracking-wide text-gray-500">
              達成マイルストーン
            </h2>
            <div className="space-y-2">
              {data.milestones.map((milestone) => (
                <div
                  key={milestone.name}
                  className="flex items-center gap-3 rounded-lg bg-green-50 px-4 py-2.5"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
                    <Check
                      className="h-3.5 w-3.5 text-white"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-base font-medium text-green-800">
                    {milestone.name}
                  </span>
                  <Badge className="ml-auto bg-green-100 text-green-700 hover:bg-green-100">
                    達成
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-8 border-t pt-5">
            <div className="text-center">
              <div className="flex items-center gap-1 text-gray-500">
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm">完走時間</span>
              </div>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {data.elapsedMinutes}分
              </p>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">達成日時</div>
              <p className="mt-1 text-base font-semibold text-gray-900">
                {formatDate(data.completedAt)}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              Certificate ID: {data.id}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Powered by GitPath
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
