CREATE TABLE IF NOT EXISTS counts (
  day TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('view', 'answer')),
  course TEXT NOT NULL,
  question TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  PRIMARY KEY (day, type, course, question)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS counts_course_type_question ON counts (course, type, question);
