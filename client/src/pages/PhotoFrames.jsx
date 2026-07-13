import CategorizedCatalog from '../components/CategorizedCatalog.jsx';

export default function PhotoFrames() {
  return (
    <div className="page-with-navbar-offset">
      <CategorizedCatalog
        title="Photo Frames"
        subtitle="High-quality photo frames available in multiple sizes"
        lockCategory="photo-frames"
      />
    </div>
  );
}
