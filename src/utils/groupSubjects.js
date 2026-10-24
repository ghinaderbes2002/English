// الـ include المطلوب لتجميع المواد حسب السنة
exports.subjectSemesterInclude = {
  select: {
    id: true, name: true, order_num: true,
    year: {
      select: {
        id: true, name: true, order_num: true,
        department: { select: { id: true, name: true } },
      },
    },
  },
};

exports.subjectOrderBy = [
  { semester: { year: { department: { order_num: 'asc' } } } },
  { semester: { year: { order_num: 'asc' } } },
  { semester: { order_num: 'asc' } },
  { id: 'asc' },
];

// بيحوّل قائمة مواد (مرتبة) لسنوات ← فصول ← مواد، لعرضها عند الأدمن
exports.groupSubjectsByYear = (subjects) => {
  const years = new Map();

  for (const { semester, ...subject } of subjects) {
    const { year } = semester;
    if (!years.has(year.id)) {
      years.set(year.id, {
        id: year.id, name: year.name, order_num: year.order_num, department: year.department,
        semesters: new Map(),
      });
    }

    const semesters = years.get(year.id).semesters;
    if (!semesters.has(semester.id)) {
      semesters.set(semester.id, { id: semester.id, name: semester.name, order_num: semester.order_num, subjects: [] });
    }
    semesters.get(semester.id).subjects.push(subject);
  }

  return [...years.values()].map((y) => ({ ...y, semesters: [...y.semesters.values()] }));
};
