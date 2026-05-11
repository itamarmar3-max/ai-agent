/**
 * Android Project Parser
 *
 * Parses Android project structure, build.gradle files,
 * AndroidManifest.xml, and provides Android-specific utilities.
 */

import { getProjectFile } from './project_manager';

export interface AndroidProjectInfo {
  applicationId: string;
  minSdk: string;
  targetSdk: string;
  compileSdk: string;
  versionCode: string;
  versionName: string;
  dependencies: string[];
  permissions: string[];
  activities: string[];
  packageName: string;
}

/**
 * Parse build.gradle for key information.
 */
function parseBuildGradle(content: string): Partial<AndroidProjectInfo> {
  const info: Partial<AndroidProjectInfo> = { dependencies: [] };

  // Application ID
  const appIdMatch = content.match(/applicationId\s+['"]([^'"]+)['"]/);
  if (appIdMatch) info.applicationId = appIdMatch[1];

  // SDK versions
  const minSdkMatch = content.match(/minSdk(?:Version)?\s+(\d+)/);
  if (minSdkMatch) info.minSdk = minSdkMatch[1];

  const targetSdkMatch = content.match(/targetSdk(?:Version)?\s+(\d+)/);
  if (targetSdkMatch) info.targetSdk = targetSdkMatch[1];

  const compileSdkMatch = content.match(/compileSdk(?:Version)?\s+(\d+)/);
  if (compileSdkMatch) info.compileSdk = compileSdkMatch[1];

  // Version
  const versionCodeMatch = content.match(/versionCode\s+(\d+)/);
  if (versionCodeMatch) info.versionCode = versionCodeMatch[1];

  const versionNameMatch = content.match(/versionName\s+['"]([^'"]+)['"]/);
  if (versionNameMatch) info.versionName = versionNameMatch[1];

  // Dependencies
  const depRegex = /(?:implementation|api|compile)\s+['"]([^'"]+)['"]/g;
  let depMatch;
  while ((depMatch = depRegex.exec(content)) !== null) {
    info.dependencies!.push(depMatch[1]);
  }

  return info;
}

/**
 * Parse AndroidManifest.xml for permissions and activities.
 */
function parseManifest(content: string): Partial<AndroidProjectInfo> {
  const info: Partial<AndroidProjectInfo> = {
    permissions: [],
    activities: [],
  };

  // Package name
  const pkgMatch = content.match(/package\s*=\s*['"]([^'"]+)['"]/);
  if (pkgMatch) info.packageName = pkgMatch[1];

  // Permissions
  const permRegex = /<uses-permission\s+android:name=['"]([^'"]+)['"]/g;
  let permMatch;
  while ((permMatch = permRegex.exec(content)) !== null) {
    info.permissions!.push(permMatch[1]);
  }

  // Activities
  const actRegex = /<activity\s+android:name=['"]([^'"]+)['"]/g;
  let actMatch;
  while ((actMatch = actRegex.exec(content)) !== null) {
    info.activities!.push(actMatch[1]);
  }

  return info;
}

/**
 * Parse an Android project and extract key information.
 */
export function parseAndroidProject(
  projectName: string,
): AndroidProjectInfo | null {
  // Try app/build.gradle first, then build.gradle
  let buildGradle = getProjectFile(projectName, 'app/build.gradle')
    || getProjectFile(projectName, 'app/build.gradle.kts');

  if (!buildGradle) {
    buildGradle = getProjectFile(projectName, 'build.gradle')
      || getProjectFile(projectName, 'build.gradle.kts');
  }

  // Try to find AndroidManifest.xml
  const manifest = getProjectFile(projectName, 'app/src/main/AndroidManifest.xml')
    || getProjectFile(projectName, 'src/main/AndroidManifest.xml');

  if (!buildGradle && !manifest) return null;

  const gradleInfo = buildGradle ? parseBuildGradle(buildGradle.content) : {};
  const manifestInfo = manifest ? parseManifest(manifest.content) : {};

  return {
    applicationId: gradleInfo.applicationId ?? manifestInfo.packageName ?? '',
    minSdk: gradleInfo.minSdk ?? '21',
    targetSdk: gradleInfo.targetSdk ?? '34',
    compileSdk: gradleInfo.compileSdk ?? '34',
    versionCode: gradleInfo.versionCode ?? '1',
    versionName: gradleInfo.versionName ?? '1.0',
    dependencies: gradleInfo.dependencies ?? [],
    permissions: manifestInfo.permissions ?? [],
    activities: manifestInfo.activities ?? [],
    packageName: manifestInfo.packageName ?? '',
  };
}

/**
 * Get the main source directory for an Android project.
 */
export function getAndroidSourceDir(projectName: string): string {
  // Check common patterns
  const paths = [
    'app/src/main/java',
    'src/main/java',
    'app/src/main/kotlin',
    'src/main/kotlin',
  ];

  for (const p of paths) {
    const file = getProjectFile(projectName, p + '/.gitkeep');
    // We check the project tree - for now return the most common path
  }

  return 'app/src/main/java';
}
