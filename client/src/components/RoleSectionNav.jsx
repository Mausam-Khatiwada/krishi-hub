const RoleSectionNav = ({ sections, activeSection, onChange, className = '' }) => {
  if (!sections?.length) return null;

  return (
    <section className={`role-section-nav ${className}`.trim()}>
      <div className="role-section-nav-scroll">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = section.key === activeSection;

          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onChange(section.key)}
              className={`role-section-pill ${isActive ? 'active' : ''}`}
            >
              {Icon ? (
                <span className="role-section-icon">
                  <Icon className="h-4 w-4" />
                </span>
              ) : null}
              <span className="role-section-copy">
                <span className="role-section-title">{section.label}</span>
                {section.description ? (
                  <span className="role-section-description">{section.description}</span>
                ) : null}
              </span>
              {typeof section.badge !== 'undefined' ? (
                <span className="role-section-badge">{section.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default RoleSectionNav;
