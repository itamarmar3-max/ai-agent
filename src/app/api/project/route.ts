import { NextResponse } from 'next/server';
import { listProjects, getProjectFile, saveProjectFile, deleteProjectFile, getProjectTree, deleteProject, extractZipProject } from '@/agent/project/project_manager';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const project = url.searchParams.get('project');
  const filePath = url.searchParams.get('file');

  try {
    if (action === 'list') {
      const projects = listProjects();
      return NextResponse.json({ projects });
    }

    if (action === 'tree' && project) {
      const tree = getProjectTree(project);
      return NextResponse.json({ tree });
    }

    if (action === 'file' && project && filePath) {
      const file = getProjectFile(project, filePath);
      if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
      return NextResponse.json({ file });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const action = formData.get('action') as string;
    const project = formData.get('project') as string;
    const filePath = formData.get('file') as string;
    const content = formData.get('content') as string;
    const zipFile = formData.get('zip') as File | null;

    if (action === 'upload_zip' && zipFile && project) {
      const buffer = Buffer.from(await zipFile.arrayBuffer());
      const projectInfo = extractZipProject(buffer, project);
      return NextResponse.json({ project: projectInfo });
    }

    if (action === 'save_file' && project && filePath && content !== null) {
      const success = saveProjectFile(project, filePath, content);
      return NextResponse.json({ success });
    }

    if (action === 'delete_file' && project && filePath) {
      const success = deleteProjectFile(project, filePath);
      return NextResponse.json({ success });
    }

    if (action === 'delete_project' && project) {
      const success = deleteProject(project);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
