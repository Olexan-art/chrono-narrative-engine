import { memo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export const StructureSection = memo(function StructureSection() {
  const { t } = useLanguage();

  const items = [
    { title: t('structure.month'), desc: t('structure.month.desc') },
    { title: t('structure.week'), desc: t('structure.week.desc') },
    { title: t('structure.day'), desc: t('structure.day.desc') },
  ];

  return (
    <section className="py-4 md:py-8 border-y border-border">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-3 gap-2 md:gap-6 max-w-4xl mx-auto">
          {items.map(({ title, desc }) => (
            <div key={title} className="text-center">
              <h3 className="font-mono text-[10px] md:text-sm text-primary mb-1 md:mb-2">{title}</h3>
              <p className="text-[10px] md:text-sm text-muted-foreground font-serif line-clamp-2 md:line-clamp-none">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
