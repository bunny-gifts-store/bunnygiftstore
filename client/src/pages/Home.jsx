import HomeHero from '../components/HomeHero.jsx';
import CategorizedCatalog from '../components/CategorizedCatalog.jsx';

export default function Home() {
  return (
    <>
      <HomeHero />
      <CategorizedCatalog
        title="Our Premium Collections"
        subtitle="Handpicked gifts curated with love for your special moments"
      />
    </>
  );
}
