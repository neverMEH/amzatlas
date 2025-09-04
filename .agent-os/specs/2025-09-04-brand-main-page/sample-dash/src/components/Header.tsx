import React, { useState } from 'react';
import { SearchIcon, UserIcon, ChevronDownIcon } from 'lucide-react';
export const Header = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('Amazon Basics');
  const brands = ['Amazon Basics', 'Nike', 'Apple', 'Samsung', 'Logitech'];
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };
  const selectBrand = brand => {
    setSelectedBrand(brand);
    setIsDropdownOpen(false);
  };
  return <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center text-blue-600 font-semibold">
              <span className="text-blue-600 bg-blue-100 p-1 rounded mr-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16.24 7.76L14.12 14.12L7.76 16.24L9.88 9.88L16.24 7.76Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              AMZ Atlas
            </div>
            <div className="hidden md:block relative">
              <div className="flex items-center space-x-2 px-4 py-2 rounded-md border border-gray-200 cursor-pointer" onClick={toggleDropdown}>
                <span>{selectedBrand}</span>
                <ChevronDownIcon size={16} />
              </div>
              {isDropdownOpen && <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <ul className="py-1">
                    {brands.map((brand, index) => <li key={index} className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => selectBrand(brand)}>
                        {brand}
                      </li>)}
                  </ul>
                </div>}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
              
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <button className="p-2 rounded-full text-gray-600 hover:bg-gray-100">
              <UserIcon size={20} />
            </button>
            <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white">
              JD
            </div>
          </div>
        </div>
      </div>
    </header>;
};