import { COGNITION_MODULE } from '@/config/lessonModules';
import { LessonTargetsPage } from './KidExpression';

/** 认知理解目标列表：和说说小课堂共用同一套列表页 */
export default function KidCognition() {
  return <LessonTargetsPage module={COGNITION_MODULE} />;
}
