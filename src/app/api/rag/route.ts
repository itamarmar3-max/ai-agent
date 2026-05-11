import { NextResponse } from 'next/server';
import { indexProject, searchIndex, hasIndex, getIndexStats, clearIndex } from '@/agent/rag';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const project = url.searchParams.get('project');
  const query = url.searchParams.get('q');

  try {
    if (action === 'stats') {
      const stats = getIndexStats(project ?? '');
      return NextResponse.json(stats);
    }

    if (action === 'has_index' && project) {
      const exists = hasIndex(project);
      return NextResponse.json({ exists });
    }

    if (action === 'search' && project && query) {
      const topK = parseInt(url.searchParams.get('topK') ?? '5');
      const results = await searchIndex(project, query, topK);
      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, projectName, files } = body;

    if (action === 'index' && projectName && Array.isArray(files)) {
      const result = await indexProject(projectName, files);
      return NextResponse.json(result);
    }

    if (action === 'clear' && projectName) {
      clearIndex(projectName);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
