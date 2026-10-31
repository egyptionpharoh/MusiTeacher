export const useParams = () => ({ labId: (location.hash.match(/lab\/([^/?]+)/) || [])[1] });
