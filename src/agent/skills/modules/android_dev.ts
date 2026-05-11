/**
 * Skill Module: Android Developer
 *
 * Expert Android development with Kotlin, MVVM architecture,
 * and full project generation ready for Android Studio.
 */

export interface SkillModule {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  systemPrompt: string;
  preferredTools: string[];
  avoidedTools: string[];
  planningTemplate: string[];
  outputFormat: string;
  clarifyingQuestions?: string[];
}

export const androidDevSkill: SkillModule = {
  name: 'android_dev',
  displayName: 'Android Dev',
  description: 'Expert Android app development with Kotlin, MVVM architecture, and full project generation.',
  icon: '📱',
  systemPrompt: `You are an expert Android developer.

## Rules
- Always use Kotlin as the default language (Java only if explicitly requested).
- Always follow MVVM architecture with proper separation of concerns.
- Always include: MainActivity, proper AndroidManifest.xml, build.gradle (or build.gradle.kts) with correct dependencies, res/ folder with layouts, strings, colors, and drawables.
- Use Jetpack Compose for modern UI unless the user requests XML layouts.
- Include proper Gradle wrapper files (gradlew, gradlew.bat, gradle/wrapper/gradle-wrapper.properties).
- Generate a project structure ready to open directly in Android Studio.
- Never skip any file needed to compile and run.
- Include proper ProGuard/R8 rules if minification is enabled.
- Follow Material Design 3 guidelines for UI components.
- Include unit test examples for ViewModels.

## Project Structure
\`\`\`
app/
  src/main/
    java/com/example/app/
      MainActivity.kt
      ui/theme/
      viewmodel/
      repository/
      model/
    res/
      layout/
      values/
      drawable/
      mipmap-*/
    AndroidManifest.xml
  build.gradle.kts
build.gradle.kts
settings.gradle.kts
gradle.properties
gradlew
gradlew.bat
gradle/wrapper/gradle-wrapper.properties
\`\`\``,
  preferredTools: [
    'write_file',
    'create_zip',
    'web_search',
    'scholar_search',
    'format_code',
    'generate_file_structure',
  ],
  avoidedTools: [
    'generate_image',
    'extract_text_from_pdf',
    'file_format_converter',
  ],
  planningTemplate: [
    'Understand app requirements and features',
    'Plan MVVM architecture and package structure',
    'Define data models and repository layer',
    'Create UI layouts and Compose screens',
    'Implement ViewModels with state management',
    'Write MainActivity and navigation setup',
    'Configure build.gradle with all dependencies',
    'Create AndroidManifest.xml with permissions',
    'Generate all resource files (strings, colors, themes)',
    'Create ZIP archive ready for Android Studio',
  ],
  outputFormat: `## Output Format
1. Full project as a ZIP file ready for Android Studio
2. File tree summary showing all generated files
3. Setup instructions:
   - How to import into Android Studio
   - Minimum SDK version and target SDK
   - Any additional setup steps (API keys, emulators, etc.)
4. Key architectural decisions explained`,
  clarifyingQuestions: [
    'What is the minimum Android version (API level) you want to support?',
    'Do you prefer Jetpack Compose or traditional XML layouts?',
    'What backend or API will the app connect to?',
  ],
};
