import { COGNITION_MODULE } from '@/config/lessonModules';
import { LessonPlayPage } from './KidExpressionPlay';

/** 认知理解练习台：和说说小课堂共用同一套 DTT 流程 */
export default function KidCognitionPlay() {
  return <LessonPlayPage module={COGNITION_MODULE} />;
}
