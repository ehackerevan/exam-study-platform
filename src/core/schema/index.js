import schemaJson from './study-pack.schema.json' with { type: 'json' };

export const STUDY_PACK_SCHEMA = schemaJson;

/**
 * 建立空白的 Study Pack 基礎物件結構
 * @param {Partial<StudyPack>} [initial]
 * @returns {StudyPack}
 */
export function createDefaultStudyPack(initial = {}) {
  return {
    version: 1,
    schemaVersion: 1,
    contentVersion: initial.contentVersion || '1.0.0',
    id: initial.id || 'study-pack-' + Date.now(),
    title: initial.title || '未命名學習教材',
    description: initial.description || '',
    language: initial.language || 'zh-TW',
    author: initial.author || '',
    chapters: Array.isArray(initial.chapters) ? initial.chapters : [],
    questions: Array.isArray(initial.questions) ? initial.questions : []
  };
}
